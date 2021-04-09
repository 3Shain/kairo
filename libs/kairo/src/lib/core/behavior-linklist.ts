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
    MaybeStale = 0x8,
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
     */
    Unstable = 0x40,
    Stable = 0x80,
    MaybeStable = 0x100,
    /**
     * current value is changed (so need to propagate)
     */
    Changed = 0x400,
    /**
     *
     */
    Zombie = 0x800,
    /**
     * dynamic is true when this is true
     */
    NotReady = 0x1000,
    LongDeps = 0x2000,
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
    effect: Watcher | null;
    effects: Watcher[] | null;
    last_observer: ObserverLinkNode<Computation> | null;
}

interface Computation<T = any> extends Data<T> {
    first_source: SourceLinkNode<Data> | null;
    last_source: SourceLinkNode<Data> | null;
    collect: () => T;
    depsReadyBits: number;
    checkNode: SourceLinkNode<Data> | null;
}

interface Watcher {
    data: Data;
    effectFn: Function;
    index: number;
    disposed: boolean;
}

let currentCollecting: Computation | null = null;

function setData<T>(data: Data<T>, value: T): void {
    if (!inTransaction) {
        return runInTransaction(() => setData(data, value));
    }
    if (data.value !== value) {
        data.value = value;
        data.flags |= Flag.Changed;
        dirtyDataQueue.push(data); // TODO: redunant?
        markObserversMaybeStale(data);
    }
}

const dirtyDataQueue: Data[] = [];
const effects: Function[] = [];

function markObserversMaybeStale(computation: Data) {
    let node = computation.last_observer;
    while (node !== null) {
        const observer = node.observer;
        if ((observer.flags & Flag.Zombie) === 0) {
            observer.depsReadyBits |= 1 << node.source_ref.index; // co-index
        }
        if (observer.flags & Flag.MaybeStale) {
            node = node.prev_observer;
            continue;
        }
        observer.flags |= Flag.MaybeStale;
        markObserversMaybeStale(observer);
        node = node.prev_observer;
    }
}

function accessData(data: Data) {
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logUnstable(currentCollecting, data);
        }
        if (data.flags & Flag.Zombie) {
            if ((currentCollecting.flags & Flag.Zombie) === 0) {
                data.flags -= Flag.Zombie; // dezombie naturally
            }
        }
    }
    return data.value;
}

function accessComputation(data: Computation) {
    if (data.flags & Flag.Computing) {
        throw new Error('Circular dependency');
    }
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Unstable) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logUnstable(currentCollecting, data);
        }
        if (data.flags & Flag.Zombie) {
            if ((currentCollecting.flags & Flag.Zombie) === 0) {
                data.flags -= Flag.Zombie; // dezombie naturally
            }
        }
    }
    if (data.flags & Flag.MaybeStale) {
        updateComputation(data);
        data.flags -= Flag.MaybeStale;
    }
    return data.value;
}

function logUnstable(accessor: Computation, data: Data) {
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
            // collected source is lesser than to_be_check
            // but it's fine? as we remove the extra sources.
            // computation.flags -= Flag.MaybeStable;
            // computation.flags |= Flag.Dynamic;
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
    // compare value , if changed, mark as changed
    if (currentValue !== computation.value) {
        computation.value = currentValue;
        computation.flags |= Flag.Changed;
    }
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

function propagate(computation: Data) {
    let notZombie = false;
    // if maybe stale
    if (computation.flags & Flag.MaybeStale) {
        if ((computation as Computation).depsReadyBits !== 0) {
            throw 'this should never happen.';
        }
        if (computation.flags & Flag.Stale) {
            updateComputation(computation as Computation);
            computation.flags -= Flag.Stale;
        }
        computation.flags -= Flag.MaybeStale;
        // now it is definitely not stale!
    }
    // if changed
    if (computation.flags & Flag.Changed) {
        let hasObserver = false;
        let observer = computation.last_observer;

        while (observer !== null) {
            let current = observer.observer;
            if (current.flags & Flag.Zombie) {
                observer = observer.prev_observer;
                continue;
            }
            if ((current.flags & Flag.MaybeStale) === 0) {
                observer = observer.prev_observer;
                hasObserver = true; // ???
                continue;
            }
            current.flags |= Flag.Stale;
            current.depsReadyBits -= 1 << observer.source_ref.index;
            if (current.depsReadyBits === 0 && propagate(current)) {
                notZombie = true;
            }
            hasObserver = true;
            observer = observer.prev_observer;
        }

        // now remove changed mark.
        computation.flags -= Flag.Changed;

        if (computation.flags & Flag.HasSideEffect) {
            // do effect
            effects.push(computation.effect!.effectFn);

            if (computation.effects) {
                for (const watcher of computation.effects) {
                    effects.push(watcher.effectFn);
                }
            }
        } else if (!hasObserver) {
            computation.flags |= Flag.Zombie;
        }
    } else {
        let observer = computation.last_observer;

        while (observer !== null) {
            let current = observer.observer;
            if (current.flags & Flag.Zombie) {
                continue;
            }
            current.depsReadyBits -= 1 << observer.source_ref.index;
            if (current.depsReadyBits === 0 && propagate(current)) {
                notZombie = true;
            }
            observer = observer.prev_observer;
        }
    }
    return notZombie;
}

function watch(data: Data, sideEffect: Function) {
    if (!(data.flags & Flag.HasSideEffect)) {
        data.flags |= Flag.HasSideEffect;
    }
    if (data.flags & Flag.Zombie) {
        data.flags -= Flag.Zombie;
    }
    if (data.flags & Flag.Data) {
        accessData(data);
    } else {
        accessComputation(data as Computation); // because it maybe stale?
    }
    if (data.effect) {
        data.effects ?? (data.effects = []);
        const watcher = {
            effectFn: sideEffect,
            data: data,
            index: data.effects.length,
            disposed: false,
        } as Watcher;
        data.effects.push(watcher);
        return watcher;
    } else {
        data.effect = {
            effectFn: sideEffect,
            data: data,
            index: -1,
            disposed: false,
        };
        return data.effect;
    }
}

function disposeWatcher(watcher: Watcher) {
    if (watcher.disposed) {
        return;
    }
    watcher.disposed = true;
    const data = watcher.data; // definitely effective
    if (watcher.index === -1) {
        data.effect = data.effects?.pop() ?? null;
        if (data.effect) {
            data.effect.index = -1;
        } else {
            data.flags -= Flag.HasSideEffect;
        }
    } else {
        const last = data.effects!.pop()!;
        if (watcher != last) {
            data.effects![watcher.index] = last;
        }
        if (data.effects!.length == 1) {
            data.effect = data.effects![0];
            data.effects = null;
            data.effect.index = -1;
        }
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
            index: accessing.last_source.index + 1,
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
            // index: accesed.last_observer.index + 1,
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
            // index: 0,
            source_ref: reference,
        };
        accesed.last_observer = node;
        return node;
    }
}

function createData<T>(value: T): Data<T> {
    return {
        flags: Flag.Data | Flag.Zombie,
        effect: null,
        effects: null,
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
            Flag.Computation | Flag.Zombie | Flag.MaybeStale | Flag.MaybeStable,
        effect: null,
        effects: null,
        last_observer: null,
        value: null,
        first_source: null,
        last_source: null,
        collect: fn,
        depsReadyBits: 0,
        checkNode: null,
    };
    if (options?.static) {
        ret.flags |= Flag.Stable | Flag.NotReady;
    }
    return ret;
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
};
