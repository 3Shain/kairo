import { Cleanable, Symbol_observable, TeardownLogic } from '../types';
import { doCleanup } from '../utils';

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
    HasSideEffect = 0x10,
    /**
     * (computation) is busy
     */
    Computing = 0x20,
    /**
     * sources are dynamically collected.
     * exclusive
     */
    Unstable = 0x40,
    Stable = 0x80,
    MaybeStable = 0x100,
    /**
     * current value is changed (so need to propagate)
     */
    Changed = 0x200,
    /**
     * When a computation is zombie, it is definitely markforcheck
     */
    Zombie = 0x400,
    /**
     * dynamic is true when this is true
     */
    NotReady = 0x1000,
    RenderEffect = 0x2000,
    Suspensed = 0x4000,
    Suspending = 0x8000,
}

const SUSPENSE_STATE = {};

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
    value: T | null;
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

interface Suspensed<T = any, F = undefined> extends Computation<T> {
    fallback: F;
    first_node: SuspenseNode | null;
    current_node: SuspenseNode | null;
}

interface SuspenseNode {
    dependencies: any[];
    data: Data;
    fetcher: any;
    next: SuspenseNode | null;
    cancel: Function;
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
            `Violated action: You can't mutate any behavior inside a computation or side effect.`
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
    if (data.flags & (Flag.Zombie | Flag.Changed)) {
        return;
    }
    data.flags |= Flag.Changed;
    dirtyDataQueue.push(data);
    markObserversForCheck(data);
}

const dirtyDataQueue: Data[] = [];
const effects: Function[] = [];

function markObserversForCheck(computation: Data) {
    let node = computation.last_observer;
    while (node !== null) {
        const observer = node.observer;
        if ((observer.flags & Flag.Zombie) === 0) {
            observer.depsCounter++;
        }
        if (observer.flags & Flag.MarkForCheck) {
            node = node.prev_observer;
            continue;
        }
        observer.flags |= Flag.MarkForCheck;
        markObserversForCheck(observer);
        node = node.prev_observer;
    }
}

function accessData(data: Data) {
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logMaybeStable(currentCollecting, data);
        }
        if (data.flags & Flag.Zombie) {
            if ((currentCollecting.flags & Flag.Zombie) === 0) {
                data.flags -= Flag.Zombie;
            }
        }
        if (
            currentCollecting.flags & Flag.Suspensed &&
            data.flags & Flag.Suspending
        ) {
            throw SUSPENSE_STATE;
        }
    }
    return data.value;
}

function accessComputation(data: Computation) {
    if (__DEV__ && data.flags & Flag.Computing) {
        console.error(`Circular dependency detected.`);
        return data.value;
    }
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.MaybeStable) {
            logMaybeStable(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        }
        if (data.flags & Flag.Zombie) {
            if ((currentCollecting.flags & Flag.Zombie) === 0) {
                data.flags -= Flag.Zombie;
                data.value = updateComputation(data);
                data.flags -= Flag.MarkForCheck;
            }
        }
        if (
            currentCollecting.flags & Flag.Suspensed &&
            data.flags & Flag.Suspending
        ) {
            throw SUSPENSE_STATE;
        }
    } else {
        if (data.flags & (Flag.MarkForCheck | Flag.Zombie)) {
            // potential optimization: memo? that's too complex.
            data.flags |= Flag.Computing;
            const currentValue = data.collect();
            data.flags -= Flag.Computing;
            return currentValue;
        }
    }
    return data.value;
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

function collectSourceAndRecomputeComputation(computation: Computation) {
    const stored = currentCollecting;
    currentCollecting = computation;
    computation.checkNode = computation.first_source;
    computation.flags |= Flag.Computing;

    let currentValue;

    if (computation.flags & Flag.Suspensed) {
        try {
            computation.flags |= Flag.Suspending;
            currentValue = computation.collect((fetcher: any, ...args: any[]) =>
                readSuspense(computation as Suspensed, fetcher, args)
            );
            computation.flags -= Flag.Suspending;
        } catch (e) {
            if (e === SUSPENSE_STATE) {
                // a _behavior_ has been collected and it will schedule an update later.
            } else {
                // it's an error! TODO: deal with the error.
            }
            currentValue = (computation as Suspensed).fallback;
        } finally {
            (computation as Suspensed).current_node = null;
        }
    } else {
        currentValue = computation.collect();
    }

    computation.flags -= Flag.Computing;
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

function readSuspense(
    suspensed: Suspensed,
    fetcher: Function,
    dependencies: any[]
) {
    let currentChecking: SuspenseNode | null;
    if (suspensed.current_node === null) {
        currentChecking = suspensed.first_node;
    } else {
        currentChecking = suspensed.current_node.next;
    }
    if (currentChecking === null) {
        currentChecking = {
            data: createData(null),
            next: null,
            dependencies,
            cancel: () => {},
            // settled: false,
            fetcher,
        };
        suspensed.current_node = currentChecking;
        if (suspensed.first_node === null) {
            suspensed.first_node = currentChecking;
        }
    } else {
        suspensed.current_node = currentChecking;
        if (compareSuspense(currentChecking, fetcher, dependencies)) {
            // it is the same
            return accessData(currentChecking.data);
        }
        let next = currentChecking.next;
        currentChecking.next = null; // otherwise discard remain nodes
        while (next != null) {
            if (next.next == null) {
                break;
            }
            next = next.next;
        }
        next?.cancel();
    }
    accessData(currentChecking.data); // log read
    currentChecking.fetcher = fetcher;
    currentChecking.dependencies = dependencies;
    // start fetch effect
    fetcher.call(void 0, ...dependencies).then((x: any) => {
        setData(currentChecking!.data, x, false);
    }); // TODO: cancellation support & task (need to rewrite)
    throw SUSPENSE_STATE;
}

function compareSuspense(
    node: SuspenseNode,
    fetcher: any,
    dependencies: any[]
) {
    if (node.fetcher !== fetcher) {
        return false;
    }
    if (node.dependencies.length !== dependencies.length) {
        return false;
    }
    for (let i = 0; i < node.dependencies.length; i++) {
        if (node.dependencies[i] !== dependencies[i]) {
            return false;
        }
    }
    return true;
}

function untrack<T>(fn: (...args: any[]) => T, ...args: any[]) {
    const stored = currentCollecting;
    currentCollecting = null;
    const ret = fn(...args);
    currentCollecting = stored;
    return ret;
}

function updateComputation(computation: Computation) {
    if (computation.flags & Flag.Unstable) {
        cleanupComputation(computation, null);
    }
    const currentValue = collectSourceAndRecomputeComputation(computation);

    if (computation.flags & Flag.NotReady) {
        computation.flags -= Flag.NotReady;
        if (computation.flags & Flag.Stable) {
            computation.flags -= Flag.MaybeStable;
        }
    }
    return currentValue;
}

function cleanupComputation(
    cell: Computation,
    until: SourceLinkNode<any> | null | 0 // it is guaranteed to be inside sources link list.
) {
    let source = cell.last_source;
    while (source !== null && source !== until) {
        const lastobserver = source.source.last_observer!;
        source.source.last_observer = lastobserver.prev_observer;
        if (lastobserver.prev_observer !== null) {
            lastobserver.prev_observer.next_observer = null; // as it is the new tail.
        }
        if (lastobserver === source.observer_ref) {
            source = source.prev_source;
            continue;
        }
        const co_ref = source.observer_ref; // this one should be before lastobserver, so let lastobserver take its place.
        // lastobserver.index = co_ref.index;
        lastobserver.prev_observer = co_ref.prev_observer;
        if (lastobserver.prev_observer !== null) {
            // it's the new prev
            lastobserver.prev_observer.next_observer = lastobserver;
        }
        lastobserver.next_observer = co_ref.next_observer;
        if (lastobserver.next_observer !== null) {
            // it's the new next
            lastobserver.next_observer.prev_observer = lastobserver;
        }
        // here co_ref has been refed by no object, wait to be GC.
        source = source.prev_source;
        // source?.next = null; // no need to do this
    }
    if (!until) {
        // it is a full clean
        cell.first_source = null;
        cell.last_source = null;
    } else {
        cell.last_source = until;
    }
}

function propagate(data: Data) {
    let notZombie = false;
    // if maybe stale (not for data)
    if (data.flags & Flag.MarkForCheck) {
        if (data.flags & Flag.Computation) {
            if (__TEST__ && (data as Computation).depsCounter !== 0) {
                throw 'this should never happen.';
            }
            if (data.flags & Flag.Stale) {
                const currentValue = updateComputation(data as Computation);
                // compare value , if changed, mark as changed
                if (currentValue !== data.value) {
                    data.value = currentValue;
                    data.flags |= Flag.Changed;
                }
                data.flags -= Flag.Stale;
            }
        } else if (data.flags & Flag.RenderEffect) {
            if (data.flags & Flag.Stale) {
                data.flags |= Flag.Changed;
                // render effect will keep stale? until outside render execute.
            }
        }
        data.flags -= Flag.MarkForCheck;
        // now it is definitely not stale!
    }
    // if changed
    if (data.flags & Flag.Changed) {
        let observer = data.last_observer;
        while (observer !== null) {
            let current = observer.observer;
            if (current.flags & Flag.Zombie) {
                observer = observer.prev_observer;
                continue;
            }
            if (__TEST__ && (current.flags & Flag.MarkForCheck) === 0) {
                throw 'should never happen'; // how is this possible? It could not even be mocked in unit tests.
            }
            current.flags |= Flag.Stale;
            current.depsCounter--;
            notZombie = true;
            if (current.depsCounter === 0 && propagate(current)) {
            }
            observer = observer.prev_observer;
        }
        data.flags -= Flag.Changed;
        if (data.last_effect) {
            notZombie = true;
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
            if (current.flags & Flag.Zombie) {
                observer = observer.prev_observer;
                continue;
            }
            current.depsCounter--;
            notZombie = true;
            if (current.depsCounter === 0 && propagate(current)) {
            }
            observer = observer.prev_observer;
        }
        if (data.last_effect) {
            notZombie = true;
        }
    }
    if (!notZombie) {
        data.flags |= Flag.Zombie;
        if (data.flags & Flag.Computation) {
            data.flags |= Flag.MarkForCheck;
        }
    }
    return notZombie;
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
    if (data.flags & Flag.Zombie) {
        data.flags -= Flag.Zombie;
        if (data.flags & Flag.Computation) {
            data.value = updateComputation(data as Computation);
            data.flags -= Flag.MarkForCheck;
        }
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

// TODO: Make node zombie if no watcher.
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

function createRenderEffect() {
    // a renderEffect can never be zombie!
    const ret: Computation<null> = {
        flags: Flag.RenderEffect | Flag.Zombie | Flag.MaybeStable | Flag.Stale,
        last_effect: null,
        last_observer: null,
        value: null,
        first_source: null,
        last_source: null,
        collect: null as any,
        depsCounter: 0,
        checkNode: null,
    };
    // ret.last_effect!.data = ret;
    return ret;
}

function executeRenderEffect<T>(
    computation: Computation<null>,
    fn: (...args: any[]) => T,
    ...args: any[]
) {
    if (__TEST__ && inTransaction) {
        throw Error('should be not in transaction');
    }
    if (__TEST__ && currentCollecting) {
        throw Error('should be not in computation');
    }
    if (computation.flags & Flag.Zombie) {
        // potential optimization: memo? that's too complex.
        computation.flags |= Flag.Computing;
        const currentValue = fn(...args);
        computation.flags -= Flag.Computing;
        return currentValue;
    }
    if (computation.flags & Flag.Stale) {
        if (computation.flags & Flag.Unstable) {
            cleanupComputation(computation, null);
        }
        currentCollecting = computation;
        computation.checkNode = computation.first_source;
        computation.flags |= Flag.Computing;
        const currentValue = fn(...args);
        computation.flags -= Flag.Computing;
        if (computation.flags & Flag.MaybeStable) {
            // check the real used deps is lesser than assumed.
            if (computation.checkNode !== null) {
                // collected source num is less than expected
                // but it's fine as we remove the extra sources.
                cleanupComputation(
                    computation,
                    computation.checkNode.prev_source
                ); // if last_source after checknode?
            }
        }
        computation.checkNode = null;
        currentCollecting = null;
        computation.value = currentValue as any; // memo

        computation.flags -= Flag.Stale;
        return currentValue;
    }
    return (computation.value as any) as T;
}

/**
 *
 * @param computation
 * @deprecated
 */
function cleanupRenderEffect(computation: Computation<null>) {
    cleanupComputation(computation, null);
    disposeWatcher(computation.last_effect!);
}

// cleanup render effect?

function createData<T>(value: T): Data<T> {
    return {
        flags: Flag.Data | Flag.Zombie,
        last_effect: null,
        last_observer: null,
        value,
    };
}

function createComputation<T>(
    fn: () => T,
    options?: {
        static: boolean;
        sources?: Data[];
    }
) {
    const ret: Computation<T> = {
        flags:
            Flag.Computation |
            Flag.Zombie |
            Flag.MarkForCheck |
            Flag.MaybeStable,
        last_effect: null,
        last_observer: null,
        value: null,
        first_source: null,
        last_source: null,
        collect: fn,
        depsCounter: 0,
        checkNode: null,
    };
    if (options?.static) {
        ret.flags |= Flag.Stable | Flag.NotReady;
    }
    return ret;
}

function createSuspensed<T, F>(fn: (read: Function) => T, fallback: F) {
    const ret: Suspensed<T, F> = {
        flags:
            Flag.Computation |
            Flag.Suspensed |
            Flag.Zombie |
            Flag.MarkForCheck |
            Flag.MaybeStable,
        last_effect: null,
        last_observer: null,
        value: null,
        first_source: null,
        last_source: null,
        collect: fn,
        depsCounter: 0,
        checkNode: null,
        fallback,
        current_node: null,
        first_node: null,
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

export function mutable<T>(initialValue: T): [Behavior<T>, (value: T) => void] {
    const internal = createData(initialValue);
    return [new Behavior(internal), (v) => setData(internal, v, true)];
}

export function computed<T>(expr: () => T, staticDependencies = false) {
    const internal = createComputation(expr, {
        static: staticDependencies,
    });
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
    createRenderEffect,
    executeRenderEffect,
    cleanupRenderEffect,
    SUSPENSE_STATE,
    createSuspensed,
};
