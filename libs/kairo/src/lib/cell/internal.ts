import { noop, panic } from '../utils';

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
   * current value is changed (so need to propagate)
   */
  Changed = 0x8,
  /**
   * (computation) current value maybe stale
   */
  MarkForCheck = 0x20,
  /**
   *
   */
  Estimating = 0x10,
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

interface WatcherLinkedNode {
  fn: Function;
  prev: WatcherLinkedNode | null;
  next: WatcherLinkedNode | null;
  disposed: boolean;
  data: Data;
}

interface SourceLinkedNode<T> {
  prev_source: SourceLinkedNode<T> | null;
  next_source: SourceLinkedNode<T> | null;
  source: T;
  observer_ref: ObserverLinkedNode<any>;
}

interface ObserverLinkedNode<T> {
  prev_observer: ObserverLinkedNode<T> | null;
  next_observer: ObserverLinkedNode<T> | null;
  observer: T;
}

interface Data<T = any> {
  flags: Flag;
  value: T | undefined;
  last_effect: WatcherLinkedNode | null;
  last_observer: ObserverLinkedNode<Computation> | null;
  depsCounter: number;
}

interface Computation<T = any> extends Data<T> {
  checkNode: SourceLinkedNode<Data> | null;
  cleanNode: SourceLinkedNode<Data> | null;
  first_source: SourceLinkedNode<Data> | null;
  last_source: SourceLinkedNode<Data> | null;
  collect: Function;
}

interface Suspense<T = any, F = undefined> extends Computation<T> {
  fallback: F;
  currentCancel: (() => void) | undefined;
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
    return transaction(() => setData(data, value, equalCheck));
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
let last: ObserverLinkedNode<any> | null = null;

function addDirtyData(data: Data) {
  if (last === null) {
    last = {
      prev_observer: null,
      next_observer: null,
      observer: data,
    };
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
  if (inTransaction) {
    data.flags |= Flag.Estimating;
    const value = data.collect();
    data.flags &= ~Flag.Estimating;
    return value;
  }
  if (data.flags & Flag.Stale) {
    estimateComputation(data, data.collect);
  }
  return data.value; // current value
}

function estimateComputation(comp: Computation, expr: Function) {
  if (__DEV__ && (comp.flags & Flag.Stale) === 0) {
    panic(10);
  }
  comp.flags |= Flag.Estimating;
  comp.flags &= ~Flag.Stale;
  const value = computeAndCollect(comp, expr);
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

function computeAndCollect<T>(
  computation: Computation<T>,
  computeExpr: Function
) {
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
    cleanupSources(computation.last_source, computation.checkNode.prev_source);
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
  from: SourceLinkedNode<Data> | null,
  until: SourceLinkedNode<Data> | null
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
    }
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
    let observer = data.last_observer;
    const changes = (data.flags & Flag.Changed) >> 1; // 8>>1 = 4
    while (observer !== null) {
      const current = observer.observer;
      observer = observer.prev_observer;
      current.flags |= changes; // bug: data can be stale, too.
      current.depsCounter--;
      if (current.depsCounter === 0) {
        stack.push(current);
        current.flags &= ~Flag.MarkForCheck;
        if (current.flags & Flag.Stale) {
          current.flags &= ~Flag.Stale;
          if (current.flags & Flag.Lazy) {
            // lazy comp will keep stale? until re-estimated.
            current.flags |= Flag.Changed | Flag.Stale;
          } else if (current.flags & Flag.Computation) {
            const currentValue = computeAndCollect(
              current as Computation,
              (current as Computation).collect
            );
            // compare value , if changed, mark as changed
            if (currentValue !== current.value) {
              current.value = currentValue;
              current.flags |= Flag.Changed;
            }
          }
        }
      }
    }
    if (changes) {
      data.flags &= ~Flag.Changed;
      let watcher = data.last_effect;
      while (watcher !== null) {
        effects.push(watcher.fn);
        watcher = watcher.prev;
      }
    }
  }
}

function watch(data: Data, sideEffect: Function) {
  if (__DEV__ && currentCollecting) {
    console.error(`You should not watch inside computation.`);
    return { disposed: true } as WatcherLinkedNode;
  }

  const node: WatcherLinkedNode = {
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

function disposeWatcher(watcher: WatcherLinkedNode) {
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

function transaction<T>(fn: () => T) {
  if (inTransaction) {
    // already inside a transaction
    return fn();
  }
  inTransaction = true;
  const retValue = fn();
  inTransaction = false;

  const data = {
    flags: Flag.Changed | Flag.MarkForCheck,
    last_observer: last,
    last_effect: null,
    value: undefined,
    depsCounter: 0,
  };
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
    const node: SourceLinkedNode<Data> = {
      source: source,
      prev_source: accessing.last_source,
      next_source: null,
      observer_ref: insertNewObserver(source, accessing),
    };
    accessing.last_source.next_source = node;
    accessing.last_source = node;
  } else {
    const node: SourceLinkedNode<Data> = {
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
): ObserverLinkedNode<any> {
  if (accesed.last_observer !== null) {
    const node: ObserverLinkedNode<Computation> = {
      observer: observer,
      prev_observer: accesed.last_observer,
      next_observer: null,
    };
    accesed.last_observer.next_observer = node;
    accesed.last_observer = node;
    return node;
  } else {
    const node: ObserverLinkedNode<Computation> = {
      observer: observer,
      prev_observer: null,
      next_observer: null,
    };
    accesed.last_observer = node;
    return node;
  }
}

function createLazy<T>(initial?: T) {
  const ret: Computation<T> = {
    flags: Flag.Computation | Flag.Lazy | Flag.Stale,
    last_effect: null,
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

export {
  Computation,
  Data,
  Flag,
  transaction,
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
