import { Cleanable, Symbol_observable, TeardownLogic } from './types';
import { doCleanup, noop, panic } from './utils';

const enum Flag {
  /**
   * this is a data */
  Data = 0b1,
  /**
   * this is a computation */
  Computation = 0x2,
  /**
   * (computation) current value is stale
   */
  Stale = 0x4,
  /**
   * (computation) current value maybe stale
   */
  MarkForCheck = 0x8,
  /**
   *
   */
  Estimating = 0x10,
  /**
   * current value is changed (so need to propagate)
   */
  Changed = 0x20,
  /**
   * dynamic is true when this is true
   */
  Suspensed = 0x40,
  Suspending = 0x80,
  Lazy = 0x100,
  Propagating = 0x200,
}

class Suspend {
  constructor(public readonly cancel: () => void) {}
}

class SuspendWithFallback extends Suspend {
  constructor(
    public readonly fallback: any,
    public readonly cancel: () => void
  ) {
    super(cancel);
  }
}

interface WatcherNode {
  fn: Function;
  prev: WatcherNode | null;
  next: WatcherNode | null;
  disposed: boolean;
  data: Data;
}

interface SourceLinkNode<T> {
  prev_source: SourceLinkNode<T> | null;
  next_source: SourceLinkNode<T> | null;
  source: T;
  observer_ref: ObserverLinkNode<any>;
}

interface ObserverLinkNode<T> {
  prev_observer: ObserverLinkNode<T> | null;
  next_observer: ObserverLinkNode<T> | null;
  observer: T;
}

interface Data<T = any> {
  flags: Flag;
  value: T | undefined;
  last_effect: WatcherNode | null;
  first_observer: ObserverLinkNode<Computation> | null;
  last_observer: ObserverLinkNode<Computation> | null;
  depsCounter: number;
}

interface Computation<T = any> extends Data<T> {
  checkNode: SourceLinkNode<Data> | null;
  cleanNode: SourceLinkNode<Data> | null;
  first_source: SourceLinkNode<Data> | null;
  last_source: SourceLinkNode<Data> | null;
  collect: Function;
}

interface Suspense<T = any, F = undefined> extends Computation<T> {
  fallback: F;
  currentCancel: (() => void) | undefined;
}

interface Watcher {
  data: Data;
  effectFn: Function;
  index: number;
  disposed: boolean;
}

let currentCollecting: Computation | null = null;

function setData<T>(data: Data<T>, value: T, equalCheck: boolean): void {
  if (__DEV__ && currentCollecting) {
    console.error(
      `Violated action: You can't mutate any behavior inside a computation.`
    );
    return;
  }
  if (!inTransaction) {
    return runInTransaction(() => setData(data, value, equalCheck));
  }
  if (equalCheck && data.value === value) {
    return;
  }
  if (data.flags & Flag.Changed) {
    console.error(`You can't set a Cell twice in a transaction.`);
    return;
  }
  data.value = value;
  data.flags |= Flag.Changed;
  addDirtyData(data);
}

const effects: Function[] = [];
let last: ObserverLinkNode<any> | null = null;
let first: ObserverLinkNode<any> | null = null;

function addDirtyData(data: Data) {
  if (first === null) {
    first = {
      prev_observer: null,
      next_observer: null,
      observer: data,
    };
    last = first;
  } else {
    const tmp = last;
    last!.next_observer = last = {
      prev_observer: tmp,
      next_observer: null,
      observer: data,
    };
  }
}

function markObserversForCheck(data: Data) {
  const stack: Data[] = [data];
  while (stack.length > 0) {
    const node = stack.pop()!;
    let p = node.last_observer;
    while (p !== null) {
      const observer = p.observer;
      p = p.prev_observer; // go_next
      observer.depsCounter++;
      if (observer.flags & Flag.MarkForCheck) {
        continue;
      }
      observer.flags |= Flag.MarkForCheck;
      stack.push(observer);
    }
  }
}

function accessData(data: Data) {
  if (currentCollecting !== null) {
    logRead(currentCollecting, data);
    if (
      currentCollecting.flags & Flag.Suspensed && // data can be suspensed?
      data.flags & Flag.Suspending
    ) {
      throw new Suspend(noop);
    }
  }
  return data.value;
}

function accessComputation<T>(data: Computation<T>): T | undefined {
  if (__DEV__ && data.flags & Flag.Lazy) {
    panic(4);
  }
  if (data.flags & Flag.Estimating) {
    // self referenced estimation.
    return data.value; // prev_state
  }
  if (currentCollecting !== null) {
    logRead(currentCollecting, data);
    if (
      currentCollecting.flags & Flag.Suspensed &&
      data.flags & Flag.Suspending
    ) {
      throw new Suspend(noop); //TODO: current cancel?
    }
  }
  if (data.flags & Flag.Stale) {
    estimateComputation(data, data.collect);
  }
  return data.value; // current value
}

/**
 * Make computation not stale.
 * Make sure computation is stale
 * @param comp
 * @returns
 */
function estimateComputation(comp: Computation, expr: Function) {
  if (__DEV__ && (comp.flags & Flag.Stale) === 0) {
    throw Error('Only stale computation can be estimated.');
  }
  comp.flags |= Flag.Estimating;
  comp.flags &= ~Flag.Stale;
  const value = doComputation(comp, expr);
  comp.value = value;
  comp.flags &= ~Flag.Estimating;
}

function logRead(accessor: Computation, data: Data) {
  if (accessor.checkNode === null) {
    insertNewSource(accessor, data);
  } else if (accessor.checkNode.source !== data) {
    // TODO: refactor
    const checkEnd = accessor.last_source;
    accessor.last_source = accessor.checkNode.prev_source;
    accessor.last_source!.next_source = null; // new last_source
    const checkStart = accessor.checkNode;
    checkStart.prev_source = null;

    accessor.cleanNode = checkEnd;

    accessor.checkNode = null;
    insertNewSource(accessor, data);
  } else {
    accessor.checkNode = accessor.checkNode.next_source;
  }
}

function untrack<T>(fn: (...args: any[]) => T, ...args: any[]) {
  const stored = currentCollecting;
  currentCollecting = null;
  const ret = fn(...args);
  currentCollecting = stored;
  return ret;
}

function doComputation<T>(computation: Computation<T>, computeExpr: Function) {
  const stored = currentCollecting;
  currentCollecting = computation;
  computation.checkNode = computation.first_source;

  let currentValue;

  if ((computation.flags & Flag.Suspensed) === 0) {
    // [likely]
    currentValue = computeExpr(computation.value);
  } else {
    (computation as Suspense).currentCancel?.(); // if is suspending, cancel last (maybe no effect)
    (computation as Suspense).currentCancel = undefined;
    try {
      computation.flags |= Flag.Suspending;
      currentValue = computeExpr(computation.value);
      computation.flags &= ~Flag.Suspending;
    } catch (e) {
      if (e instanceof Suspend) {
        // a _behavior_ should have been collected and it will schedule an update later.
        if (e instanceof SuspendWithFallback) {
          currentValue = e.fallback;
        } else {
          currentValue = (computation as Suspense).fallback;
        }
        (computation as Suspense).currentCancel = e.cancel;
      } else {
        throw e;
      }
    } finally {
    }
  }

  if (computation.checkNode !== null) {
    // collected source num is less than expected
    // but it's fine as we remove the extra sources.
    cleanupSources(
      computation.last_source,
      computation.checkNode.prev_source
    );
    computation.last_source = computation.checkNode.prev_source;
    if (computation.last_source) {
      computation.last_source.next_source = null;
    } else {
      computation.first_source = null;
      // has no source.
    }
    computation.checkNode = null;
  }
  if (computation.cleanNode) {
    // these nodes are detached from observer.
    cleanupSources(computation.cleanNode, null);
    computation.cleanNode = null;
  }
  currentCollecting = stored;
  return currentValue;
}

function cleanupComputation(computation: Computation) {
  cleanupSources(computation.last_source, null);
  computation.first_source = null;
  computation.last_source = null;
  computation.flags |= Flag.Stale;
}

function cleanupSources(
  from: SourceLinkNode<Data> | null,
  until: SourceLinkNode<Data> | null
) {
  let lastSource = from!;
  while (lastSource !== until) {
    const obRef = lastSource.observer_ref;
    if (obRef.next_observer) {
      obRef.next_observer.prev_observer = obRef.prev_observer;
    } else {
      lastSource.source.last_observer = obRef.prev_observer;
    }
    if (obRef.prev_observer) {
      obRef.prev_observer.next_observer = obRef.next_observer;
    } else {
      lastSource.source.first_observer = obRef.next_observer;
    }
    // if (obRef.observer !== computation) throw panic(200);
    obRef.observer = null;
    // last source
    const source = lastSource.source;
    if (
      source.flags & Flag.Computation &&
      source.last_observer == null &&
      source.last_effect == null
    ) {
      cleanupComputation(source as Computation);
    }
    lastSource = lastSource.prev_source!;
    if (lastSource) {
      lastSource.next_source = null;
    }
  }
}

function propagate(origin: Data): void {
  const stack: Data[] = [origin];
  while (stack.length > 0) {
    const data = stack[stack.length - 1];
    if (data.flags & Flag.Propagating) {
      stack.pop();
      data.flags -= Flag.Propagating;
      // do cleanup
      if (data.flags & Flag.Computation) {
        if (
          data.last_observer === null /* unlikely */ &&
          data.last_effect === null
        ) {
          cleanupComputation(data as Computation);
        }
      }
      continue;
    }
    data.flags |= Flag.Propagating;
    if (data.flags & Flag.MarkForCheck) {
      if (data.flags & Flag.Computation) {
        if (__TEST__ && (data as Computation).depsCounter !== 0) {
          panic(2); //should not happen
        }
        if (data.flags & Flag.Stale) {
          if (data.flags & Flag.Lazy) {
            // lazy comp will keep stale? until re-estimated.
            data.flags |= Flag.Changed;
          } else {
            const currentValue = doComputation(
              data as Computation,
              (data as Computation).collect
            );
            // compare value , if changed, mark as changed
            if (currentValue !== data.value) {
              data.value = currentValue;
              data.flags |= Flag.Changed;
            }
            data.flags &= ~Flag.Stale;
          }
        }
      } else {
        data.flags &= ~Flag.Stale; //data can be stale
      }
      data.flags &= ~Flag.MarkForCheck;
    } else {
      panic(1); // should not happen
    }
    let observer = data.last_observer;
    if (data.flags & Flag.Changed) {
      while (observer !== null) {
        const current = observer.observer;
        observer = observer.prev_observer;
        if ((current.flags & Flag.MarkForCheck) === 0) {
          continue;
        }
        current.flags |= Flag.Stale; // bug: data can be stale, too.
        current.depsCounter--;
        if (current.depsCounter === 0) {
          stack.push(current);
        }
      }
      data.flags &= ~Flag.Changed;
      let watcher = data.last_effect;
      while (watcher !== null) {
        effects.push(watcher.fn);
        watcher = watcher.prev;
      }
    } else {
      while (observer !== null) {
        const current = observer.observer;
        observer = observer.prev_observer;
        if ((current.flags & Flag.MarkForCheck) === 0) {
          continue;
        }
        current.depsCounter--;
        if (current.depsCounter === 0) {
          stack.push(current);
        }
      }
    }
  }
}

function watch(data: Data, sideEffect: Function) {
  if (__DEV__ && currentCollecting) {
    console.error(`You should not watch inside computation.`);
    return { disposed: true } as WatcherNode;
  }

  const node: WatcherNode = {
    fn: sideEffect,
    prev: data.last_effect,
    next: null,
    disposed: false,
    data: data,
  };
  if (data.last_effect) {
    data.last_effect.next = node;
  }
  data.last_effect = node;

  if (data.flags & Flag.Stale && (data.flags & Flag.Lazy) === 0) {
    // must do estimation to get deps change propagated.
    estimateComputation(data as Computation, (data as Computation).collect);
  }

  return node;
}

function disposeWatcher(watcher: WatcherNode) {
  if (__TEST__ && currentCollecting) {
    console.error('Violated action.');
    return;
  }
  if (watcher.disposed) {
    return;
  }
  watcher.disposed = true;
  if (watcher.next === null) {
    // it is the last.
    watcher.data.last_effect = watcher.prev;
  } else {
    watcher.next.prev = watcher.prev;
  }
  if (watcher.prev) {
    watcher.prev.next = watcher.next;
  }
}

let inTransaction = false;

function runInTransaction<T>(fn: () => T) {
  if (inTransaction) {
    // already inside a transaction
    return fn();
  }
  inTransaction = true;
  const retValue = fn();
  inTransaction = false;

  const data = {
    flags: Flag.Changed | Flag.MarkForCheck,
    first_observer: first,
    last_observer: last,
    last_effect: null,
    value: undefined,
    depsCounter: 0,
  };
  first = null;
  last = null;
  markObserversForCheck(data);
  propagate(data);

  while (effects.length > 0) {
    effects.pop()!();
  }

  return retValue;
}

function insertNewSource(accessing: Computation, source: Data): void {
  if (accessing.last_source !== null) {
    const node: SourceLinkNode<Data> = {
      source: source,
      prev_source: accessing.last_source,
      next_source: null,
      observer_ref: null as any,
    };
    node.observer_ref = insertNewObserver(source, accessing);
    accessing.last_source.next_source = node;
    accessing.last_source = node;
  } else {
    const node: SourceLinkNode<Data> = {
      source: source,
      prev_source: null,
      next_source: null,
      observer_ref: insertNewObserver(source, accessing),
    };
    accessing.first_source = node; // if last is null, first is definitely null.
    accessing.last_source = node;
  }
}

function insertNewObserver(
  accesed: Data,
  observer: Computation
): ObserverLinkNode<any> {
  if (accesed.last_observer !== null) {
    const node: ObserverLinkNode<Computation> = {
      observer: observer,
      prev_observer: accesed.last_observer,
      next_observer: null,
    };
    accesed.last_observer.next_observer = node;
    accesed.last_observer = node;
    return node;
  } else {
    const node: ObserverLinkNode<Computation> = {
      observer: observer,
      prev_observer: null,
      next_observer: null,
    };
    accesed.first_observer = node; // if last is null, first is definitely null.
    accesed.last_observer = node;
    return node;
  }
}

function createLazy<T>(initial?: T) {
  const ret: Computation<T> = {
    flags: Flag.Computation | Flag.Lazy | Flag.Stale,
    last_effect: null,
    first_observer: null,
    last_observer: null,
    value: (undefined as any) as T,
    checkNode: null,
    cleanNode: null,
    first_source: null,
    last_source: null,
    collect: null as any,
    depsCounter: 0,
  };
  if (initial !== undefined) {
    ret.value = initial;
  }
  return ret;
}

function executeLazy<T>(computation: Computation<T>, fn: (current: T) => T) {
  if (__TEST__ && currentCollecting) {
    throw Error('should be not in computation');
  }
  if (computation.flags & Flag.Stale) {
    estimateComputation(computation, fn);
  }
  return fn(computation.value!); // TODO: type not correct
}

function createData<T>(value: T): Data<T> {
  return {
    flags: Flag.Data,
    last_effect: null,
    first_observer: null,
    last_observer: null,
    depsCounter: 0,
    value,
  };
}

function createComputation<T>(
  fn: (current: T) => T,
  options?: {
    initial?: T;
    static?: boolean;
    sources?: Data[];
  }
) {
  const ret: Computation<T> = {
    flags: Flag.Computation | Flag.Stale,
    last_effect: null,
    first_observer: null,
    last_observer: null,
    depsCounter: 0,
    value: undefined,
    checkNode: null,
    cleanNode: null,
    first_source: null,
    last_source: null,
    collect: fn,
  };
  if (options) {
    if (options.static) {
      // ret.flags |= Flag.DepsNeverChange;
    }
    if (options.initial !== undefined) {
      ret.value = options.initial;
    }
  }
  return ret;
}

function createSuspended<T, F>(fn: (current: T | F) => T, fallback: F) {
  const ret: Suspense<T, F> = {
    flags: Flag.Computation | Flag.Suspensed | Flag.Stale,
    last_effect: null,
    first_observer: null,
    last_observer: null,
    depsCounter: 0,
    value: undefined,
    checkNode: null,
    cleanNode: null,
    first_source: null,
    last_source: null,
    collect: fn,
    fallback,
    currentCancel: undefined,
  };
  return ret;
}

export function __current_collecting() {
  return currentCollecting;
}

export function constant<T>(value: T) {
  return new Cell(createData(value));
}

export class Cell<T> {
  constructor(protected internal: Data<T>) {}

  get value(): T {
    return accessData(this.internal);
  }

  [Symbol_observable]() {
    return this;
  }

  map<R>(mapFn: (value: T) => R): Cell<R> {
    const internal = createComputation(() => mapFn(this.value), {
      static: true,
      sources: [this.internal],
    });
    return new ComputationalCell(internal);
  }

  watch(
    watchFn: (value: T) => Cleanable,
    options?: WatchOptions
  ): TeardownLogic {
    let lastDisposer: Cleanable = undefined;
    const watcher = watch(this.internal, () => {
      doCleanup(lastDisposer);
      lastDisposer = watchFn(this.internal.value!);
    });
    if (options?.immediate) {
      lastDisposer = watchFn(this.internal.value!);
    }
    return () => {
      doCleanup(lastDisposer);
      disposeWatcher(watcher!);
    };
  }

  /**
   * @deprecated Use watch.
   */
  subscribe(next: (value: T) => void) {
    const ret = this.watch(
      (v) => {
        next(v);
      },
      { immediate: true }
    );
    (ret as any).unsubscribe = ret;
    return ret as {
      (): void;
      unsubscribe(): void;
    };
  }
}

export interface WatchOptions {
  immediate?: boolean;
}

export class ComputationalCell<T> extends Cell<T> {
  constructor(internal: Computation<T>) {
    super(internal);
  }

  get value(): T {
    return accessComputation(this.internal as Computation);
  }
}

export class Lazy<T> {
  constructor(private internal: Computation<T>) {}

  execute(expr: (current: T) => T) {
    return executeLazy<T>(this.internal, expr);
  }

  watch(
    watchFn: (value: T) => Cleanable,
    options?: WatchOptions
  ): TeardownLogic {
    let lastDisposer: Cleanable = undefined;
    const watcher = watch(this.internal, () => {
      doCleanup(lastDisposer);
      lastDisposer = watchFn(this.internal.value!);
    });
    if (options?.immediate) {
      lastDisposer = watchFn(this.internal.value!);
    }
    return () => {
      doCleanup(lastDisposer);
      disposeWatcher(watcher!);
    };
  }
}

export function mutable<T>(
  initialValue: T
): [
  Cell<T>,
  (value: (T extends Function ? never : T) | ((current: T) => T)) => void
] {
  const internal = createData(initialValue);
  return [
    new Cell(internal),
    (v) => {
      if (v instanceof Function) {
        setData(internal, v(internal.value!), true);
      } else {
        setData(internal, v as any, true);
      }
    },
  ];
}

export function mutValue<T>(initialValue: T): [Cell<T>, (value: T) => void] {
  const internal = createData(initialValue);
  return [
    new Cell(internal),
    (v) => {
      setData(internal, v as any, true);
    },
  ];
}

export function lazy<T>(initial?: T) {
  return new Lazy<T>(createLazy(initial));
}

export function computed<T>(
  expr: (current: T) => T,
  options?: {
    static?: boolean;
    initial?: T;
  }
): Cell<T> {
  const internal = createComputation(expr, options);
  return new ComputationalCell(internal) as Cell<T>;
}

export function suspended<T, F = T>(
  expr: (current: T | F) => T,
  fallback: F
): Cell<T> {
  const internal = createSuspended(expr, fallback);
  return new ComputationalCell(internal);
}

export type UnwrapProperty<T> = T extends object
  ? {
      [P in keyof T]: T[P] extends Cell<infer C> ? C : T[P];
    }
  : T;

export function combined<A extends Array<Cell<any>>[]>(
  array: A
): Cell<UnwrapProperty<A>>;
export function combined<
  C extends {
    [key: string]: Cell<any>;
  }
>(obj: C): Cell<UnwrapProperty<C>>;
export function combined(obj: object): Cell<any> {
  if (obj instanceof Array) {
    return computed(
      () => {
        return obj.map((x) => {
          return x.value;
        });
      },
      { static: true }
    );
  }
  return computed(
    () => {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
          return [key, value.value];
        })
      );
    },
    { static: true }
  );
}

export {
  Computation,
  Data,
  Watcher,
  Flag,
  runInTransaction,
  setData,
  watch,
  disposeWatcher,
  accessData,
  accessComputation,
  createData,
  createComputation,
  untrack,
  createLazy,
  executeLazy,
  createSuspended,
  Suspend,
  SuspendWithFallback,
};
