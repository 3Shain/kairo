const enum BitFlags {
  /**
   * this is a data */
  Data = 1 << 0,
  /**
   * this is a memo */
  Memo = 1 << 1,
  /**
   *
   */
  Dirty = 1 << 2,
  /**
   * current value is changed (so need to propagate)
   */
  Changed = 1 << 3,
  Evalutating = 1 << 4,
  /**
   * (computation) current value maybe dirty
   */
  MarkForCheck = 1 << 5,
  /**
   *
   */
  EffectWillCommit = 1 << 6,
  // Suspending = 1 << 7,
  Effect = 1 << 8,
  // Propagating = 1 << 9,
  /** only memo can be stale */
  Stale = 1 << 10,
  ValueIsError = 1 << 11,
  Managed = 1 << 13,
  ManagedMemo = Managed | Memo,
  ValueWasError = 1 << 14,
}

interface InternalNode {
  flags: BitFlags;
}
interface Data<T = unknown> extends InternalNode {
  lo: ObserverLinked<Observer> | null;
  value: T | null;
  cp: (a: any, b: any) => boolean;
}
interface Observer extends InternalNode {
  dc: number;
  fs: SourceLinked<Data> | null;
  ls: SourceLinked<Data> | null;
}
interface Memo<T = unknown> extends Data<T>, Observer {
  c: Expression<T>;
  hs: T;
}
interface Reaction<T = unknown> extends Observer {
  e: () => T;
}
interface Expression<T> {
  (track: <D>(data: Data<D>) => D): T;
}
type SourceLinked<T> = {
  prev: SourceLinked<T> | null;
  next: SourceLinked<T> | null;
  source: T;
  observer_ref: ObserverLinked<any>;
};
type ObserverLinked<T> = {
  prev: ObserverLinked<T> | null;
  next: ObserverLinked<T> | null;
  observer: T;
};

class TrackContext {
  constructor(private observer: Observer) {}

  private lastLog: Data | null = null;
  private cursor: SourceLinked<Data> | null = this.observer.fs;
  private clean: SourceLinked<Data> | null = null;

  track<T>(data: Data<T>) {
    if (data.flags & BitFlags.Evalutating) {
      if ((data as unknown) === this.observer) {
        if (data.flags & BitFlags.ValueWasError) throw (data as Memo<T>).hs; // [EXIT 7]
        return (data as Memo<T>).hs; // [EXIT 6]
      }
      throw new ReferenceError('A circular reference occurred.'); // [EXIT 5]
    }
    this.logSource(data);
    // if propagating and current are still markForCheck
    if (data.flags & BitFlags.MarkForCheck) {
      // currently if MarkForCheck it must be in propagate phase
      throw DEFER_COMPUTATION; // [EXIT 4]
    }
    if (data.flags & BitFlags.Stale) {
      estimate(data as Memo<T>); // maybe [EXIT 3]
    }
    if (data.flags & BitFlags.ValueIsError) {
      throw data.value; // [EXIT 2]
    }
    return data.value!; // current value [EXIT 1]
  }

  private logSource(data: Data) {
    if (this.lastLog) {
      if (this.lastLog === data) {
        return;
      }
    }
    this.lastLog = data;
    if (this.cursor === null) {
      insertNewSource(this.observer, data);
    } else {
      if (this.cursor.source !== data) {
        this.clean = this.observer.ls;
        this.observer.ls = this.cursor.prev;
        if (this.observer.ls) {
          this.observer.ls!.next = null; // new last_source
          this.cursor.prev = null; //
        } else {
          this.observer.fs = null;
        }
        this.cursor = null;
        insertNewSource(this.observer, data);
      } else {
        this.cursor = this.cursor.next;
      }
    }
  }

  cleanup() {
    if (this.cursor !== null) {
      this.clean = this.observer.ls;
      this.observer.ls = this.cursor.prev;
      if (this.observer.ls) {
        this.observer.ls.next = null; // new last_source
        this.cursor.prev = null;
      } else {
        // cursor.prev == null => zero dependency is logged: settled forever.
        this.observer.fs = null;
      }
    }
    return this.clean;
  }
}

class EvalContext {
  toCleanup: SourceLinked<Data>[] = [];

  /**
   * Evaluate the expression and track (refresh) dependencies.
   * @param observer
   * @param expression
   * @returns Computed latest vaue
   * @throws User-land errors, DEFER_COMPUTATION
   */
  evaluate<T>(observer: Observer, expression: Expression<T>): T {
    const ctx = new TrackContext(observer);
    observer.flags |= BitFlags.Evalutating;
    try {
      return expression((x) => ctx.track(x));
    } finally {
      observer.flags &= ~BitFlags.Evalutating;
      const clean = ctx.cleanup();
      if (clean) this.toCleanup.push(null!, clean);
    }
  }

  cleanup() {
    const array = this.toCleanup;
    while (array.length > 0) {
      let last: SourceLinked<Data> = array.pop()!,
        until: SourceLinked<Data> | null = array.pop()!;
      do {
        const {
          source,
          observer_ref: { next, prev },
        } = last; /* no first source so do nothing */
        last.observer_ref.observer = null; // not necessary (but might be gc friendly)
        (next ? (next.prev = prev) : (source.lo = prev))
          ? (prev!.next = next)
          : null;
        if (isUnusedMemo(source)) {
          source.flags =
            (source.flags | BitFlags.Stale) & ~BitFlags.MarkForCheck;
          source.dc = 0; // not usable...
          source.value = null;
          if (source.ls) {
            array.push(null!, source.ls!);
            source.ls = null;
            source.fs = null;
          }
        }
      } while ((last = last.prev!) !== until);
    }
  }
}

function setData<T>(data: Data<T>, value: T): void {
  if (!ct) {
    return nt.start(() => setData(data, value));
  }
  ct.setData(data, value);
}

function accessCurrent<T>(data: Data<T>, obs: Memo<any> | null = null): T {
  if (data.flags & BitFlags.Evalutating) {
    if ((data as unknown) === obs) {
      if (data.flags & BitFlags.ValueWasError) throw (data as Memo<T>).hs;
      return (data as Memo<T>).hs;
    }
    throw new ReferenceError('A circular reference occurred.');
  }
  if (data.flags & BitFlags.MarkForCheck && ct !== null && !ct.flushing) {
    ct.flush();
  }
  if (data.flags & BitFlags.Stale) {
    // eager evaluate latest value
    try {
      data.flags |= BitFlags.Evalutating;
      return (data as Memo).c((x) => accessCurrent(x, data as Memo)) as T;
    } finally {
      data.flags &= ~BitFlags.Evalutating;
    }
  } else {
    if (data.flags & BitFlags.ValueIsError) {
      throw data.value; // [EXIT 2]
    }
    return data.value!; // current value [EXIT 1]
  }
}

function estimate<T>(memo: Memo<T>) {
  memo.flags &= ~BitFlags.Stale;
  const ctx = new EvalContext();
  try {
    memo.value = ctx.evaluate(memo, memo.c);
    memo.flags &= ~BitFlags.ValueIsError;
  } catch (e: any) {
    if (e === DEFER_COMPUTATION) {
      // it will be propagated later
      // _must mark dirty_ because the source may be unchanged but this node must be recomputed.
      memo.flags |= BitFlags.MarkForCheck | BitFlags.Dirty | BitFlags.Stale;
      memo.dc++;
      throw e; // [EXIT 3]
    }
    memo.flags |= BitFlags.ValueIsError;
    memo.value = e;
  }
  ctx.cleanup(); //should be just no-op
}

function isMemo(node: Observer): node is Memo {
  return (node.flags & BitFlags.Memo) === BitFlags.Memo;
}

function isUnusedMemo(source: Data): source is Memo {
  return (
    (source.flags & BitFlags.ManagedMemo) === BitFlags.ManagedMemo &&
    source.lo === null
  );
}

function markObserversForCheck(stack: Data[]) {
  while (stack.length > 0) {
    let lo = stack.pop()!.lo;
    while (lo !== null) {
      const observer = lo.observer;
      observer.dc++;
      if ((observer.flags & BitFlags.MarkForCheck) === 0) {
        observer.flags |= BitFlags.MarkForCheck;
        if (observer.flags & BitFlags.Memo) {
          stack.push(observer as unknown as Data);
        }
      }
      lo = lo.prev;
    }
  }
}

let ct: TransactionContext | null = null;

class TransactionContext {
  dirty: Data[] = [];
  effects: Reaction[] = [];
  flushing: boolean = false;

  constructor() {}

  start<T>(fn: () => T) {
    const stored = ct;
    ct = this;
    let retValue = null;
    try {
      retValue = fn(); // setData and markObserversForCheck will (should) not throw
      // if an error occured it should be caused by user
    } finally {
      // flush even if there is an error. otherwise a bad state is left
      // and effects will not be commited but preserved
      this.flush(); // will (should) not throw
      ct = stored;
    }
    controlOnCommit(() => this.commit());
    return retValue;
  }

  flush() {
    this.flushing = true;
    this.propagate(this.dirty);
    this.flushing = false;
  }

  commit() {
    const effects = this.effects;
    while (effects.length) {
      const x = effects.pop()!;
      x.flags &= ~BitFlags.EffectWillCommit;
      /**
       * should catch error here?
       * no. and unrecoverable.
       */
      if (x.fs) {
        try {
          x.e(); //in case it's disposed
        } catch (e) {
          setTimeout(() => {
            throw e;
          }); //hostErrorReports
        }
      }
    }
  }

  setData<T>(data: Data, value: T) {
    /* istanbul ignore if: noop */ if (data.cp(data.value, value)) {
      return;
    }
    data.value = value;
    if (data.flags & BitFlags.Changed) {
      return;
    }
    data.flags |= BitFlags.Changed;
    markObserversForCheck([data]); //
    this.dirty.push(data);
  }

  propagate(stack: Data[]): void {
    const ctx = new EvalContext();
    while (stack.length > 0) {
      const data = stack.pop()!;
      const sdf = data.flags;
      const dirtyIfChanged = (sdf & BitFlags.Changed) >> 1; // 8>>1 = 4
      data.flags &= ~BitFlags.Changed;
      let lo = data.lo;
      while (lo !== null) {
        const observer = lo.observer;
        lo = lo.prev;
        observer.flags |= dirtyIfChanged; // changes -> dirty
        observer.dc--;

        if (observer.dc === 0) {
          const scf = (observer.flags &= ~BitFlags.MarkForCheck);
          if (isMemo(observer)) {
            // it's a memo
            stack.push(observer); // push()
            if (scf & BitFlags.Dirty) {
              observer.flags =
                ((scf & BitFlags.ValueIsError) > 0
                  ? observer.flags | BitFlags.ValueWasError
                  : observer.flags & ~BitFlags.ValueWasError) & ~BitFlags.Dirty;
              observer.hs = observer.value;
              try {
                const currentValue = ctx.evaluate(observer, observer.c);
                // compare value , if changed, mark as changed
                if (
                  !observer.cp(currentValue, observer.value) ||
                  observer.flags & BitFlags.ValueIsError
                ) {
                  observer.flags =
                    (observer.flags | BitFlags.Changed) &
                    ~BitFlags.ValueIsError;
                  observer.value = currentValue;
                }
              } catch (e) {
                if (e === DEFER_COMPUTATION) {
                  // computation deferred as a upstream dependency is waiting for propagation.
                  stack.pop(); // pop()
                  observer.flags |= BitFlags.Dirty | BitFlags.MarkForCheck;
                  observer.dc++;
                  continue;
                }
                // TODO: should check error equality?
                observer.value = e;
                observer.flags |= BitFlags.Changed | BitFlags.ValueIsError;
              }
            }
          } else {
            // if (scf & BitFlags.Effect) {
            if (scf & BitFlags.Dirty) {
              observer.flags &= ~BitFlags.Dirty;
              if (~scf & BitFlags.EffectWillCommit) {
                this.effects.push(observer as Reaction);
                observer.flags |= BitFlags.EffectWillCommit;
              }
            }
            // }
          }
        }
      }
    }
    ctx.cleanup();
  }
}

const nt = new TransactionContext();
function batch(fn: Function) {
  if (ct !== null) {
    return fn();
  }
  return nt.start(fn as any);
}

function insertNewSource(observer: Observer, source: Data): void {
  observer.ls = observer.ls
    ? (observer.ls.next = {
        prev: observer.ls,
        next: null,
        source,
        observer_ref: insertNewObserver(source, observer),
      })
    : (observer.fs = {
        prev: null,
        next: null,
        source,
        observer_ref: insertNewObserver(source, observer),
      });
}

function insertNewObserver(
  source: Data,
  observer: Observer
): ObserverLinked<Observer> {
  return (source.lo = source.lo
    ? (source.lo.next = {
        prev: source.lo,
        next: null,
        observer,
      })
    : { prev: null, next: null, observer });
}

function createReaction(onCommit: () => void): Reaction {
  return {
    flags: BitFlags.Effect,
    dc: 0,
    fs: null,
    ls: null,
    e: onCommit,
  };
}

function executeReaction<T>(reaction: Observer, fn: Expression<T>) {
  const ctx = new EvalContext();
  try {
    return ctx.evaluate(reaction, fn);
  } finally {
    ctx.cleanup();
  }
}

function createData<T>(
  value: T,
  comp: (a: T, b: T) => boolean = Object.is
): Data<T> {
  return {
    flags: BitFlags.Data,
    lo: null,
    value: value,
    cp: comp,
  };
}

function createMemo<T>(
  fn: Expression<T>,
  comp: (a: T, b: T) => boolean = Object.is,
  initial?: T
): Memo<T> {
  return {
    flags: BitFlags.Memo | BitFlags.Stale | BitFlags.Managed,
    lo: null,
    value: null!,
    cp: comp,
    dc: 0,
    fs: null,
    ls: null,
    c: fn,
    hs: initial!,
  };
}

let controlOnCommit = ((x) => x()) as (continuation: () => void) => any;

/* istanbul ignore next: simple */
export function takeControlOnCommit(
  controller: (continuation: () => void) => any
) {
  controlOnCommit = controller;
}

/**
 * Only for _extra dependencies added_
 */
const DEFER_COMPUTATION = {};

export {
  BitFlags,
  Data,
  Memo,
  Reaction,
  batch,
  setData,
  accessCurrent as accessReferenceValue,
  createData,
  createMemo,
  createReaction,
  executeReaction,
};
