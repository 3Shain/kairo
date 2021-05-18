import { Cleanable, Symbol_observable, TeardownLogic } from '../types';
import { doCleanup, noop } from '../utils';

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
     * sources are dynamically collected.
     * exclusive
     */
    Unstable = 0x20,
    Stable = 0x40,
    MaybeStable = 0x80,
    /**
     * current value is changed (so need to propagate)
     */
    Changed = 0x100,
    /**
     * dynamic is true when this is true
     */
    NotReady = 0x200,
    Suspensed = 0x400,
    Suspending = 0x800,
    Lazy = 0x1000,
    Marking = 0x2000,
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
    index: number;
    observer_ref: ObserverLinkNode<any>;
}

interface ObserverLinkNode<T> {
    prev_observer: ObserverLinkNode<T> | null;
    next_observer: ObserverLinkNode<T> | null;
    observer: T;
    source_ref: SourceLinkNode<any>;
}

interface Data<T = any> {
    flags: Flag;
    value: T | undefined;
    last_effect: WatcherNode | null;
    last_observer: ObserverLinkNode<Computation> | null;
}

interface Computation<T = any> extends Data<T> {
    first_source: SourceLinkNode<Data> | null;
    last_source: SourceLinkNode<Data> | null;
    collect: Function;
    depsCounter: number;
    checkNode: SourceLinkNode<Data> | null;
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
    data.value = value;
    if (data.flags & Flag.Changed) {
        return;
    }
    data.flags |= Flag.Changed | Flag.MarkForCheck;
    dirtyDataQueue.push(data);
    markObserversForCheck(data);
}

const dirtyDataQueue: Data[] = [];
const effects: Function[] = [];

function markObserversForCheck(computation: Data) {
    computation.flags |= Flag.Marking;
    let node = computation.last_observer;
    while (node !== null) {
        const observer = node.observer;
        if (observer.flags & Flag.Marking) {
            // skip circular observer.
            node = node.prev_observer;
            continue;
        }
        observer.depsCounter++;
        if (observer.flags & Flag.MarkForCheck) {
            node = node.prev_observer;
            continue;
        }
        observer.flags |= Flag.MarkForCheck;
        markObserversForCheck(observer);
        node = node.prev_observer;
    }
    computation.flags -= Flag.Marking;
}

function accessData(data: Data) {
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logMaybeStable(currentCollecting, data);
        }
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
    if (data.flags & Flag.Estimating) {
        // self referenced estimation.
        data.flags |= Flag.Stale;
        return data.value; //?wtf
    }
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.MaybeStable) {
            logMaybeStable(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        }
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
    return data.value;
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
    while (true) {
        comp.flags -= Flag.Stale;
        const value = updateComputationOneEpoch(comp, expr);
        if (comp.flags & Flag.Stale) {
            if (comp.value === value) {
                comp.flags -= Flag.Stale;
                break;
            } else {
                comp.value = value;
            }
        } else {
            comp.value = value;
            break;
        }
    }
    comp.flags -= Flag.Estimating;
}

function logMaybeStable(accessor: Computation, data: Data) {
    if (accessor.checkNode === null) {
        insertNewSource(accessor, data);
    } else if (accessor.checkNode.source !== data) {
        // it is unstable!
        accessor.flags -= Flag.MaybeStable;
        accessor.flags |= Flag.Unstable;
        cleanupComputation(accessor, accessor.checkNode.prev_source);
        insertNewSource(accessor, data);
    } else {
        accessor.checkNode = accessor.checkNode.next_source;
    }
}

function collectSourceAndRecomputeComputation(
    computation: Computation,
    computeExpr: Function
) {
    const stored = currentCollecting;
    currentCollecting = computation;
    computation.checkNode = computation.first_source;

    let currentValue;

    if (computation.flags & Flag.Suspensed) {
        (computation as Suspense).currentCancel?.(); // if is suspending, cancel last (maybe no effect)
        (computation as Suspense).currentCancel = undefined;
        try {
            computation.flags |= Flag.Suspending;
            currentValue = computeExpr(computation.value);
            computation.flags -= Flag.Suspending;
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
    } else {
        currentValue = computeExpr(computation.value);
    }

    if (computation.flags & Flag.MaybeStable) {
        // check the real used deps is lesser than assumed.
        if (computation.checkNode !== null) {
            // collected source num is less than expected
            // but it's fine as we remove the extra sources.
            cleanupComputation(computation, computation.checkNode.prev_source); // if last_source after checknode?
        }
    }
    computation.checkNode = null;
    currentCollecting = stored;
    return currentValue;
}

function untrack<T>(fn: (...args: any[]) => T, ...args: any[]) {
    const stored = currentCollecting;
    currentCollecting = null;
    const ret = fn(...args);
    currentCollecting = stored;
    return ret;
}

function updateComputationOneEpoch(computation: Computation, expr: Function) {
    if (computation.flags & Flag.Unstable) {
        cleanupComputation(computation, null);
    }
    const currentValue = collectSourceAndRecomputeComputation(
        computation,
        expr
    );

    if (computation.flags & Flag.NotReady) {
        computation.flags -= Flag.NotReady;
        computation.flags -= Flag.MaybeStable;
    }
    return currentValue;
}

function cleanupComputation(
    cell: Computation,
    until: SourceLinkNode<any> | null | 0 // it is guaranteed to be inside sources link list.
) {
    let lastSource = cell.last_source;
    while (lastSource !== null && lastSource !== until) {
        lastSource.next_source = null; // not necessary? but give GC a chance?
        const observerRef = lastSource.observer_ref;
        if (observerRef.next_observer) {
            observerRef.next_observer.prev_observer = observerRef.prev_observer;
        } else {
            // observerRef is the last observer
            lastSource.source.last_observer = observerRef.prev_observer;
        }
        if (observerRef.prev_observer) {
            observerRef.prev_observer.next_observer = observerRef.next_observer;
        } else {
            // it's the first observer: noop
        }
        // observerRef.prev_observer = null; // don't do this! propagate() still need it!
        lastSource = lastSource.prev_source;
    }
    if (!until) {
        // it is a full clean
        cell.first_source = null;
        cell.last_source = null;
        if (cell.flags & Flag.Stable) {
            cell.flags |= Flag.NotReady | Flag.MaybeStable;
        }
    } else {
        cell.last_source = until;
    }
}

function propagate(data: Data): void {
    while (true) {
        if (data.flags & Flag.MarkForCheck) {
            if (data.flags & Flag.Computation) {
                if (__TEST__ && (data as Computation).depsCounter !== 0) {
                    throw 'this should never happen.';
                }
                if (data.flags & Flag.Stale) {
                    if (data.flags & Flag.Lazy) {
                        // lazy comp will keep stale? until re-estimated.
                        data.flags |= Flag.Changed;
                    } else {
                        const currentValue = updateComputationOneEpoch(
                            data as Computation,
                            (data as Computation).collect
                        );
                        // compare value , if changed, mark as changed
                        if (currentValue !== data.value) {
                            data.value = currentValue;
                            data.flags |= Flag.Changed;
                        }
                        data.flags -= Flag.Stale;
                    }
                }
            }
            data.flags -= Flag.MarkForCheck;
        } else {
            if (
                data.flags & Flag.Computation &&
                data.last_observer === null &&
                data.last_effect === null
            ) {
                cleanupComputation(data as Computation, 0);
                data.flags |= Flag.Stale;
            }
            break;
        }
        // if changed
        if (data.flags & Flag.Changed) {
            let observer = data.last_observer;
            while (observer !== null) {
                let current = observer.observer;
                if ((current.flags & Flag.MarkForCheck) === 0) {
                    current.flags |= Flag.MarkForCheck | Flag.Stale; // self referenced or circular referenced.
                    observer = observer.prev_observer;
                    continue;
                }
                current.flags |= Flag.Stale;
                current.depsCounter--;
                if (current.depsCounter === 0) {
                    propagate(current);
                }
                observer = observer.prev_observer;
            }
            data.flags -= Flag.Changed;
            if ((data.flags & Flag.MarkForCheck) === 0 && data.last_effect) {
                //ensure markforcheck is zero: no loopback.
                let watcher: WatcherNode | null = data.last_effect;
                while (watcher !== null) {
                    effects.push(watcher.fn);
                    watcher = watcher.prev;
                }
            }
        } else {
            let observer = data.last_observer;
            while (observer !== null) {
                let current = observer.observer;
                if ((current.flags & Flag.MarkForCheck) === 0) {
                    // loop back but without any change
                    observer = observer.prev_observer;
                    continue;
                }
                current.depsCounter--;
                if (current.depsCounter === 0) {
                    propagate(current);
                }
                observer = observer.prev_observer;
            }
        }

        if (data.flags & Flag.MarkForCheck) {
            // and Stale definitely
            markObserversForCheck(data); // tail: refresh
        }
    }
}

function watch(data: Data, sideEffect: Function) {
    if (__DEV__ && currentCollecting) {
        console.error(`You should not watch inside computation.`);
        return { disposed: true } as WatcherNode;
    }
    if (__DEV__ && inTransaction) {
        console.error(
            `You should not watch inside transaction, as it will breaks dep structure.`
        );
        return { disposed: true } as WatcherNode;
    }
    if (data.flags & Flag.Stale && (data.flags & Flag.Lazy) === 0) {
        estimateComputation(data as Computation, (data as Computation).collect);
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

    while (dirtyDataQueue.length) {
        const data = dirtyDataQueue.pop()!;
        propagate(data);
    }

    while (effects.length) {
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
            index: accessing.last_source.index + 1, // use less?
            observer_ref: null as any,
        };
        node.observer_ref = insertNewObserver(source, accessing, node);
        accessing.last_source.next_source = node;
        accessing.last_source = node;
    } else {
        const node: SourceLinkNode<Data> = {
            source: source,
            prev_source: null,
            next_source: null,
            index: 0,
            observer_ref: null as any,
        };
        node.observer_ref = insertNewObserver(source, accessing, node);
        accessing.first_source = node; // if last is null, first is definitely null.
        accessing.last_source = node;
    }
}

function insertNewObserver(
    accesed: Data,
    observer: Computation,
    reference: SourceLinkNode<any>
): ObserverLinkNode<any> {
    if (accesed.last_observer !== null) {
        const node: ObserverLinkNode<Computation> = {
            observer: observer,
            prev_observer: accesed.last_observer,
            next_observer: null,
            source_ref: reference,
        };
        accesed.last_observer.next_observer = node;
        accesed.last_observer = node;
        return node;
    } else {
        const node: ObserverLinkNode<Computation> = {
            observer: observer,
            prev_observer: null,
            next_observer: null,
            source_ref: reference,
        };
        accesed.last_observer = node;
        return node;
    }
}

function createLazy<T>(initial?: T) {
    const ret: Computation<T> = {
        flags: Flag.Computation | Flag.Lazy | Flag.MaybeStable | Flag.Stale,
        last_effect: null,
        last_observer: null,
        value: (undefined as any) as T,
        first_source: null,
        last_source: null,
        collect: null as any,
        depsCounter: 0,
        checkNode: null,
    };
    if (initial !== undefined) {
        ret.value = initial;
    }
    return ret;
}

function executeLazy<T>(computation: Computation<T>, fn: (current: T) => T) {
    if (__TEST__ && inTransaction) {
        throw Error('should be not in transaction');
    }
    if (__TEST__ && currentCollecting) {
        throw Error('should be not in computation');
    }
    if (computation.flags & Flag.Stale) {
        estimateComputation(computation, fn);
    }
    return (computation.value as any) as T;
}

function createData<T>(value: T): Data<T> {
    return {
        flags: Flag.Data,
        last_effect: null,
        last_observer: null,
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
        flags: Flag.Computation | Flag.MaybeStable | Flag.Stale,
        last_effect: null,
        last_observer: null,
        value: undefined,
        first_source: null,
        last_source: null,
        collect: fn,
        depsCounter: 0,
        checkNode: null,
    };
    if (options) {
        if (options.static) {
            ret.flags |= Flag.Stable | Flag.NotReady;
        }
        if (options.initial !== undefined) {
            ret.value = options.initial;
        }
    }
    return ret;
}

function createSuspended<T, F>(fn: (current: T | F) => T, fallback: F) {
    const ret: Suspense<T, F> = {
        flags:
            Flag.Computation | Flag.Suspensed | Flag.MaybeStable | Flag.Stale,
        last_effect: null,
        last_observer: null,
        value: undefined,
        first_source: null,
        last_source: null,
        collect: fn,
        depsCounter: 0,
        checkNode: null,
        fallback,
        currentCancel: undefined,
    };
    return ret;
}

export function __current_collecting() {
    return currentCollecting;
}

export function constant<T>(value: T) {
    return new Behavior(createData(value));
}

export class Behavior<T> {
    constructor(protected internal: Data<T>) {}

    get value(): T {
        return accessData(this.internal);
    }

    [Symbol_observable]() {
        return this;
    }

    map<R>(mapFn: (value: T) => R): Behavior<R> {
        const internal = createComputation(() => mapFn(this.value), {
            static: true,
            sources: [this.internal],
        });
        return new ComputationalBehavior(internal);
    }

    switch<R>(
        switchFn: (value: T) => Behavior<R> /* use output type? */
    ): Behavior<R> {
        const internal = createComputation(() => {
            const returned = untrack(switchFn, this.value);
            return returned.value;
        });
        return new ComputationalBehavior(internal);
    }

    watch(watchFn: (value: T) => Cleanable): TeardownLogic {
        let lastDisposer: Cleanable = undefined;
        const watcher = watch(this.internal, () => {
            doCleanup(lastDisposer);
            lastDisposer = watchFn(this.internal.value!);
        });
        return () => disposeWatcher(watcher!);
    }

    /**
     * @deprecated Use watch.
     */
    subscribe(next: (value: T) => void) {
        const ret = this.watch((v) => {
            next(v);
        });
        next(this.internal.value!);
        (ret as any).unsubscribe = ret;
        return ret as {
            (): void;
            unsubscribe(): void;
        };
    }
}

export class ComputationalBehavior<T> extends Behavior<T> {
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

    watch(watchFn: (value: T) => Cleanable): TeardownLogic {
        let lastDisposer: Cleanable = undefined;
        const watcher = watch(this.internal, () => {
            doCleanup(lastDisposer);
            lastDisposer = watchFn(this.internal.value!);
        });
        return () => disposeWatcher(watcher!);
    }
}

export function mutable<T>(initialValue: T): [Behavior<T>, (value: T) => void] {
    const internal = createData(initialValue);
    return [new Behavior(internal), (v) => setData(internal, v, true)];
}

export function lazy<T>(initial?: T) {
    return new Lazy<T>(createLazy(initial));
}

export function computed<T>(
    expr: (current: T) => T,
    staticDependencies = false
): Behavior<T> {
    const internal = createComputation(expr, {
        static: staticDependencies,
    });
    return new ComputationalBehavior(internal);
}

export function suspended<T, F = T>(
    expr: (current: T | F) => T,
    fallback: F
): Behavior<T> {
    const internal = createSuspended(expr, fallback);
    return new ComputationalBehavior(internal);
}

export type ExtractBehaviorProperty<T> = T extends object
    ? {
          [P in keyof T]: T[P] extends Behavior<infer C> ? C : T[P];
      }
    : T;

export function combined<A extends Array<Behavior<any>>[]>(
    array: A
): Behavior<ExtractBehaviorProperty<A>>;
export function combined<
    C extends {
        [key: string]: Behavior<any>;
    }
>(obj: C): Behavior<ExtractBehaviorProperty<C>>;
export function combined(obj: object): Behavior<any> {
    if (obj instanceof Array) {
        return computed(() => {
            return obj.map((x) => {
                return x.value;
            });
        }, true);
    }
    return computed(() => {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => {
                return [key, value.value];
            })
        );
    }, true);
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
    cleanupComputation,
    createLazy,
    executeLazy,
    createSuspended,
    Suspend,
    SuspendWithFallback,
};
