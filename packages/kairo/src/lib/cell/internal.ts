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
  Estimating = 1 << 4,
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
  StaleMemo = 1 << 10,
  HasError = 1 << 11,
}

interface Data<T = unknown> {
  flags: BitFlags;
  lo: ObserverLinked<Memo> | null;
  value: T | null;
  cp: (a: any, b: any) => boolean;
}
interface Memo<T = unknown> extends Data<T> {
  dc: number;
  fs: SourceLinked<Data> | null;
  ls: SourceLinked<Data> | null;
  c: () => T;
}
interface Reaction extends Memo<void> {}
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

let ctx_cc: Memo | null = null;
let ctx_cn: SourceLinked<Data> | null = null;
let ctx_cln: SourceLinked<Data> | null = null;
let ctx_lr: Data | null = null;

function setData<T>(data: Data<T>, value: T): void {
  /* istanbul ignore if */
  if (__DEV__ && ctx_cc) {
    console.error(
      `Violated action: You can't mutate any behavior inside a computation or reaction.`
    );
    return;
  }
  if (!ct) {
    return batch(() => setData(data, value));
  }
  /* istanbul ignore if: noop */ if (data.cp(data.value, value)) {
    return;
  }
  data.value = value;
  if (data.flags & BitFlags.Changed) {
    return;
  }
  data.flags |= BitFlags.Changed;
  ct.addDirty(data);
}

/**
 * Get the value of a node _in many contexts_. Full of dirty side-effects.
 * @param data
 * @returns current value, or previous value if circularly referenced
 * @throws User-land errors, DEFER_COMPUTATION
 */
function accessValue<T>(data: Data<T>, readDeps: boolean): T {
  if (data.flags & BitFlags.Estimating) {
    /**
     * In fact we could allow circular referencing, by returning the latest value.
     * However this causes a memo node to _hold a state_.
     * Thus a memo expression is _impure_: same inputs, changed result.
     */
    throw new ReferenceError('A circular reference occurred.'); // [EXIT 5]
  }
  if (data.flags & BitFlags.MarkForCheck && ct !== null && !ct.flushing) {
    ct.flush();
  }
  if (readDeps && ctx_cc !== null) {
    logDependency(data);
    // if propagating and current are still markForCheck
    if (data.flags & BitFlags.MarkForCheck) {
      // currently if MarkForCheck it must be in propagate phase
      throw DEFER_COMPUTATION; // [EXIT 4]
    }
  }
  if (data.flags & BitFlags.StaleMemo) {
    data.flags &= ~BitFlags.StaleMemo;
    estimate(data); // maybe [EXIT 3]
  }
  if (data.flags & BitFlags.HasError) {
    throw data.value; // [EXIT 2]
  }
  return data.value!; // current value [EXIT 1]
}

function estimate<T>(data: Data<T>) {
  data.flags |= BitFlags.Estimating;
  const s_ctx_cc = ctx_cc,
    s_ctx_cn = ctx_cn,
    s_ctx_cln = ctx_cln,
    s_ctx_lr = ctx_lr;
  (ctx_cc = data as Memo<T>), (ctx_lr = null), (ctx_cln = null);
  try {
    data.value = evaluate(data as Memo<T>, (data as Memo<T>).c, s_ctx_cc);
    data.flags &= ~BitFlags.HasError;
  } catch (e: any) {
    if (e === DEFER_COMPUTATION) {
      // it will be propagated later
      // _must mark dirty_ because the source may be unchanged but this node must be recomputed.
      data.flags |= BitFlags.MarkForCheck | BitFlags.Dirty;
      (data as Memo).dc++;
      throw e; // [EXIT 3]
    }
    data.flags |= BitFlags.HasError;
    data.value = e;
  } finally {
    (ctx_lr = s_ctx_lr), (ctx_cln = s_ctx_cln), (ctx_cn = s_ctx_cn);
    data.flags &= ~BitFlags.Estimating;
  }
}

/**
 * Assure ctx_cc is not null
 * @param accessing
 * @returns
 */
function logDependency(accessing: Data) {
  if (ctx_lr) {
    if (ctx_lr === accessing) {
      return;
    }
  }
  ctx_lr = accessing;
  if (ctx_cn === null) {
    insertNewSource(ctx_cc!, accessing);
  } else {
    if (ctx_cn.source !== accessing) {
      ctx_cln = ctx_cc!.ls;
      ctx_cc!.ls = ctx_cn.prev;
      ctx_cc!.ls!.next = null; // new last_source
      ctx_cn.prev = null; //
      ctx_cn = null;
      insertNewSource(ctx_cc!, accessing);
    } else {
      ctx_cn = ctx_cn.next;
    }
  }
}

function untrack<T, Args extends any[]>(
  fn: (...args: Args) => T,
  ...args: Args
) {
  const stored = ctx_cc,
    s_ctx_cn = ctx_cn,
    s_ctx_cln = ctx_cln,
    s_ctx_lr = ctx_lr;
  /* reset context */
  ctx_cc = null;
  ctx_cn = null;
  ctx_cln = null;
  ctx_lr = null;
  let ret = null;
  try {
    ret = fn(...args);
  } finally {
    ctx_lr = s_ctx_lr;
    ctx_cln = s_ctx_cln;
    ctx_cn = s_ctx_cn;
    ctx_cc = stored;
  }
  return ret;
}

const NO_ERROR = {};

/**
 * Compute the latest value of a memo node. And track (refresh) dependencies. (insert then clean-up)
 * @param observer
 * @param expr
 * @returns Computed latest vaue
 * @throws User-land errors, DEFER_COMPUTATION
 */
function evaluate<T>(
  observer: Memo,
  expr: () => T,
  restore_ctx_cc: typeof ctx_cc
) {
  ctx_cn = (ctx_cc = observer).fs;

  let calculatedValue: T | null,
    error = NO_ERROR;

  try {
    calculatedValue = expr();
  } catch (e: any) {
    error = e;
  }
  ctx_lr = null;
  if (ctx_cn !== null) {
    /* istanbul ignore if */
    if (__DEV__ && observer.ls === null) {
      throw Error('panic 7');
    }
    // collected source num is less than expected
    // but it's fine as we remove the extra sources.
    cleanupSources(observer.ls!, ctx_cn.prev);
    observer.ls = ctx_cn.prev;
    if (observer.ls) {
      observer.ls.next = null;
    } else {
      observer.fs = null; // no source. will not update. (but not stale.)
    }
    ctx_cn = null;
  } else if (ctx_cln !== null) {
    // why deferred: to not clean a node so early
    cleanupSources(ctx_cln, null);
    ctx_cln = null;
  }
  ctx_cc = restore_ctx_cc;
  if (error !== NO_ERROR) {
    throw error;
  }
  return calculatedValue! as T;
}

function cleanupMemo(memo: Memo) {
  if (memo.ls === null) {
    return;
  }
  cleanupSources(memo.ls, null);
  memo.fs = null;
  memo.ls = null;
}

function cleanupSources(
  last: SourceLinked<Data>,
  until: SourceLinked<Data> | null
) {
  do {
    const {
      source,
      observer_ref: { next, prev },
    } = last; /* no first source so do nothing */
    // last.observer_ref.observer = null; // not necessary (but might be gc friendly)
    (next ? (next.prev = prev) : (source.lo = prev))
      ? (prev!.next = next)
      : null;
    if (source.flags & BitFlags.Memo && source.lo === null) {
      // it's last observer // but propagation might tackle this.
      cleanupMemo(source as Memo);
      source.flags |= BitFlags.StaleMemo;
    }
  } while ((last = last.prev!) !== until);
}

function propagate(stack: Data[]): void {
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
        if (scf & BitFlags.Effect) {
          if (scf & BitFlags.Dirty) {
            observer.flags &= ~BitFlags.Dirty;
            if (~scf & BitFlags.EffectWillCommit) {
              ct!.effects.push(observer as Reaction);
              observer.flags |= BitFlags.EffectWillCommit;
            }
          }
        } else if (observer.lo === null) {
          // it's a memo but no one observing.
          cleanupMemo(observer);
          observer.flags &= ~BitFlags.Dirty;
          observer.flags |= BitFlags.StaleMemo;
        } else {
          // it's a memo
          stack.push(observer); // push()
          if (scf & BitFlags.Dirty) {
            observer.flags &= ~BitFlags.Dirty;
            // if propagate receives array of data then the if is not necessary
            try {
              const currentValue = evaluate(observer, observer.c, null);
              // compare value , if changed, mark as changed
              if (
                !observer.cp(currentValue, observer.value) ||
                observer.flags & BitFlags.HasError
              ) {
                observer.flags &= ~BitFlags.HasError;
                observer.value = currentValue;
                observer.flags |= BitFlags.Changed;
              }
            } catch (e) {
              if (e === DEFER_COMPUTATION) {
                // computation deferred as a upstream dependency is waiting for propagation.
                stack.pop(); // pop()
                observer.flags |= BitFlags.Dirty | BitFlags.MarkForCheck;
                observer.dc++;
              } else {
                // TODO: should check error equality?
                observer.value = e;
                observer.flags |= BitFlags.Changed | BitFlags.HasError;
              }
            }
          }
        }
      }
    }
  }
}

function markObserversForCheck(stack: Data[]) {
  while (stack.length > 0) {
    const node = stack.pop()!;
    let lo = node.lo;
    while (lo !== null) {
      const observer = lo.observer;
      lo = lo.prev;
      observer.dc++;
      if (observer.flags & BitFlags.MarkForCheck) {
        continue;
      }
      observer.flags |= BitFlags.MarkForCheck;
      if (~observer.flags & BitFlags.Effect) {
        stack.push(observer);
      }
    }
  }
}

let ct: Transaction | null = null;

class Transaction {
  dirty: Data[] = [];
  effects: Reaction[] = [];

  constructor() {}

  start(fn: () => any) {
    const stored = ct;
    ct = this;
    let retValue = null;
    try {
      retValue = fn();
      this.flush();
    } finally {
      ct = stored;
    }
    controlOnCommit(() => this.commit());
    return retValue;
  }

  flushing: boolean = false;

  flush() {
    this.flushing = true;
    propagate(this.dirty);
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
      x.c();
    }
  }

  addDirty(data: Data) {
    markObserversForCheck([data]);
    this.dirty.push(data);
  }
}

const nt = new Transaction();
function batch(fn: Function) {
  if (ct !== null) {
    return fn();
  }
  return nt.start(fn as any);
}

function insertNewSource(observer: Memo, source: Data): void {
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

function insertNewObserver(source: Data, observer: Memo): ObserverLinked<Memo> {
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
    lo: null, // never used
    value: null, // never used
    cp: null!, // never used
    dc: 0,
    fs: null,
    ls: null,
    c: onCommit,
  };
}

function executeReaction<T>(reaction: Reaction, fn: () => T) {
  /* istanbul ignore if */
  if (__TEST__ && ctx_cc) {
    throw Error('should be not in computation or reaction');
  }
  return evaluate(reaction, fn, null);
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
  fn: () => T,
  comp: (a: T, b: T) => boolean = Object.is
): Memo<T> {
  return {
    flags: BitFlags.Memo | BitFlags.StaleMemo,
    lo: null,
    value: null!,
    cp: comp,
    dc: 0,
    fs: null,
    ls: null,
    c: fn,
  };
}

export function __current_transaction() {
  return ct;
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
  accessValue,
  createData,
  createMemo,
  untrack,
  createReaction,
  executeReaction,
  cleanupMemo,
};
