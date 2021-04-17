/**
 * Not fully tested yet.
 * Suspected to be faster by 10% than current impl.
 */

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
    Changed = 0x400,
    /**
     * When a computation is zombie, it is definitely markforcheck
     */
    Zombie = 0x800,
    /**
     * dynamic is true when this is true
     */
    NotReady = 0x1000,
    RenderEffect = 0x2000,
    MaskRenderEffect = 0x4000,
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
    value: T | null;
    last_effect: WatcherNode | null;
    last_observer: ObserverLinkNode<Computation> | null;
}

interface Computation<T = any> extends Data<T> {
    first_source: SourceLinkNode<Data> | null;
    last_source: SourceLinkNode<Data> | null;
    collect: () => T;
    depsCounter: number;
    checkNode: SourceLinkNode<Data> | null;
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
    const currentValue = computation.collect();
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
                throw 'should never haapen';
                // observer = observer.prev_observer;
                // notZombie = true;
                // this will happen if the observer is propagated already
                // as repeatation is allowed in the linked list
                // are you fucking sure?
                // if a node is propagated already, it should never be here!
                // continue;
            }
            current.flags |= Flag.Stale;
            current.depsCounter--;
            if (current.depsCounter === 0 && propagate(current)) {
                notZombie = true;
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
                continue;
            }
            current.depsCounter--;
            if (current.depsCounter === 0 && propagate(current)) {
                notZombie = true;
            }
            observer = observer.prev_observer;
        }
        if (data.last_effect) {
            notZombie = true;
        }
    }
    if (!notZombie) {
        if (__TEST__) console.log('stop updating?');
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

function createRenderEffect(sideEffect: Function) {
    // a renderEffect can never be zombie!
    const ret: Computation<null> = {
        flags: Flag.RenderEffect | Flag.MaybeStable | Flag.Stale,
        last_effect: {
            fn: sideEffect,
            prev: null,
            next: null,
            disposed: false,
            data: null as any,
        },
        last_observer: null,
        value: null,
        first_source: null,
        last_source: null,
        collect: null as any,
        depsCounter: 0,
        checkNode: null,
    };
    ret.last_effect!.data = ret;
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

export function __current_collecting() {
    return currentCollecting;
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
};
