
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
    SingleObserver = 0x40,
    SingleSource = 0x80,
    /**
     * sources are dynamically collected.
     */
    Dynamic = 0x100,
    Stable = 0x4000,
    MaybeStable = 0x200,
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
    LongDeps = 0x2000
}

interface Data<T = any> {
    flags: Flag,
    value: T | null,
    effect: Watcher | null,
    effects: Watcher[] | null,
    observer: Computation | null,
    observerSlot: number,
    observers: Computation[] | null,
    observerSlots: number[] | null,
}

interface Computation<T = any> extends Data<T> {
    source: Data | null,
    sourceSlot: number,
    sources: Data[] | null,
    sourceSlots: number[] | null,
    collect: () => T,
    depsReadyBits: number,
    checkIndex: number
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
    if (computation.flags & Flag.SingleObserver) {
        const observer = computation.observer!;
        if (observer !== null) {
            if ((observer.flags & Flag.Zombie) === 0) {
                observer.depsReadyBits |= (1 << computation.observerSlot!); // maximum 52 dependencies
            }
            if ((observer.flags & Flag.MaybeStale)) {
                return;
            }
            observer.flags |= Flag.MaybeStale;
            markObserversMaybeStale(observer);
        }
    } else {
        for (let i = 0; i < computation.observers!.length; i++) {
            const observer = computation.observers![i];
            if ((observer.flags & Flag.Zombie) === 0) {
                observer.depsReadyBits |= (1 << computation.observerSlots![i]);
            }
            if (observer.flags & Flag.MaybeStale) {
                continue;
            }
            observer.flags |= Flag.MaybeStale;
            markObserversMaybeStale(observer);
        }
    }
}

function accessData(data: Data) {
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Dynamic) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logUnstable(currentCollecting, data);
        }
        if (data.flags & Flag.Zombie) {
            if((currentCollecting.flags & Flag.Zombie) === 0) {
                data.flags -= Flag.Zombie; // dezombie naturally
            }
        }
    }
    return data.value;
}

function accessComputation(data: Computation) {
    if ((data.flags & Flag.Computing)) {
        throw new Error('Circular dependency');
    }
    if (currentCollecting !== null) {
        if (currentCollecting.flags & Flag.Dynamic) {
            insertNewSource(currentCollecting, data);
        } else if (currentCollecting.flags & Flag.MaybeStable) {
            logUnstable(currentCollecting, data);
        } 
        if (data.flags & Flag.Zombie) {
            if((currentCollecting.flags & Flag.Zombie) === 0) {
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
    if (accessor.flags & Flag.SingleSource) {
        if (accessor.source! !== data) {
            // currentCollecting.source is definitely not null? why?
            // deps changed
            accessor.flags -= Flag.MaybeStable;
            accessor.flags |= Flag.Dynamic;
            // clean observers from here
            if (accessor.checkIndex === 0) {
                // checkIndex == 0 means this is the first source
                // first source doesn't match?
                cleanupComputationOfSingleSource(accessor);
                // otherwise it changes from single source to multi source.
            }
            insertNewSource(accessor, data); // still need to log.
        } else {
            accessor.checkIndex++;
        }
    } else {
        const checkIndex = accessor.checkIndex;
        if (checkIndex >= accessor.sources!.length
            || data !== accessor.sources![checkIndex]) {
            // deps changed.
            accessor.flags -= Flag.MaybeStable;
            accessor.flags |= Flag.Dynamic;
            // clean observers from here
            cleanupComputation(accessor, checkIndex);
            insertNewSource(accessor, data);
        } else {
            accessor.checkIndex++;
        }
    }
}

function collectSourceAndRecomputeComputation(computation: Computation) {
    const stored = currentCollecting;
    currentCollecting = computation;
    computation.flags |= Flag.Computing;
    const currentValue = computation.collect();
    computation.flags -= Flag.Computing;
    if (computation.flags & Flag.MaybeStable) {
        // check the real used deps is lesser than assumed.
        if (computation.flags & Flag.SingleSource) {
            if (computation.checkIndex === 0 && computation.source !== null) {
                computation.flags -= Flag.MaybeStable;
                computation.flags |= Flag.Dynamic;
                cleanupComputationOfSingleSource(computation);
            }
        }
        else if (computation.checkIndex != computation.sources!.length) {
            computation.flags -= Flag.MaybeStable;
            computation.flags |= Flag.Dynamic;
            cleanupComputation(computation, computation.checkIndex);
        }
        currentCollecting.checkIndex = 0;
    }
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
    if (computation.flags & Flag.Dynamic) {
        cleanupComputation(computation, 0);
    }
    const currentValue = collectSourceAndRecomputeComputation(computation);

    if (computation.flags & Flag.NotReady) {
        computation.flags -= (Flag.NotReady | Flag.Dynamic);
        if (computation.flags & Flag.Stable) {
            computation.flags |= Flag.Stable;
        } else {
            computation.flags |= Flag.MaybeStable;
        }
    }
    // compare value , if changed, mark as changed
    if (currentValue !== computation.value) {
        computation.value = currentValue;
        computation.flags |= Flag.Changed; // maybe problematic?
    }
}

function cleanupComputationOfSingleSource(cell: Computation) {
    if (cell.source === null) {
        return;
    }
    let theSource = cell.source!;
    let observerSlotOfLastSourceOfComputation = cell.sourceSlot!;
    cell.source = null;
    cell.sourceSlot = -1;

    if ((theSource.flags & Flag.SingleObserver) && theSource.observer !== null) {
        theSource.observer = null;
        theSource.observerSlot = -1;
    } else {
        // here observers is definitely not empty:
        let lastObserverOfSource = theSource.observers!.pop()!;
        let sourceSlotOfLastObserverOfSource = theSource.observerSlots!.pop()!; //我原来在哪儿，要找回去。

        if (observerSlotOfLastSourceOfComputation == theSource.observers!.length) {
            // lucky, you are just the last observer
            return;
        }
        // replace you with last observer
        theSource.observers![observerSlotOfLastSourceOfComputation] = lastObserverOfSource;
        theSource.observerSlots![observerSlotOfLastSourceOfComputation] = sourceSlotOfLastObserverOfSource;

        // notify the change of position
        if (lastObserverOfSource.flags & Flag.SingleSource) {
            lastObserverOfSource.sourceSlot = observerSlotOfLastSourceOfComputation;
        } else {
            lastObserverOfSource.sourceSlots![sourceSlotOfLastObserverOfSource] = observerSlotOfLastSourceOfComputation;
        }
    }
}

function cleanupComputation(cell: Computation, remain: number) {
    if (cell.flags & Flag.SingleSource) {
        return cleanupComputationOfSingleSource(cell);
    }
    while (cell.sources!.length > remain) {
        let theSource = cell.sources!.pop()!;
        let observerSlotOfLastSourceOfComputation = cell.sourceSlots!.pop()!;

        if (theSource.flags & Flag.SingleObserver && theSource.observer! !== null) {
            theSource.observer = null;
            theSource.observerSlot! = -1;
        } else {
            let lastObserverOfSource = theSource.observers!.pop()!;
            let sourceSlotOfLastObserverOfSource = theSource.observerSlots!.pop()!;

            if (observerSlotOfLastSourceOfComputation == theSource.observers!.length) {
                continue;
            }

            theSource.observers![observerSlotOfLastSourceOfComputation] = lastObserverOfSource;
            theSource.observerSlots![observerSlotOfLastSourceOfComputation] = sourceSlotOfLastObserverOfSource;

            if (lastObserverOfSource.flags & Flag.SingleSource) {
                lastObserverOfSource.sourceSlot! = observerSlotOfLastSourceOfComputation;
            } else {
                lastObserverOfSource.sourceSlots![sourceSlotOfLastObserverOfSource] = observerSlotOfLastSourceOfComputation;
            }
        }
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
        if (computation.flags & Flag.SingleObserver) {
            const observer = computation.observer;
            if (observer !== null) {
                if ((observer.flags & Flag.Zombie) === 0) {
                    observer.flags |= Flag.Stale;
                    observer.depsReadyBits -= (1 << computation.observerSlot);
                    if (observer.depsReadyBits === 0 && propagate(observer)) {
                        notZombie = true;
                    }
                    hasObserver = true;
                }
            }
        } else {
            for (let i = 0; i < computation.observers!.length;) {
                let current = computation.observers![i];
                if (current.flags & Flag.Zombie) {
                    i++;
                    continue;
                }
                if ((current.flags & Flag.MaybeStale) === 0) {
                    i++;
                    hasObserver = true; // ???
                    continue;
                }
                current.flags |= Flag.Stale;
                current.depsReadyBits -= (1 << computation.observerSlots![i]);
                if (current.depsReadyBits === 0 && propagate(current)) {
                    notZombie = true;
                }
                if (current === computation.observers![i]) {
                    i++;
                }
                hasObserver = true;
            }
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
        if (computation.flags & Flag.SingleObserver) {
            if (computation.observer !== null) {
                // TODO: make inline cache?
                if (!(computation.observer.flags & Flag.Zombie)) {
                    computation.observer.depsReadyBits -= (1 << computation.observerSlot);
                    if (computation.observer.depsReadyBits === 0 && propagate(computation.observer)) {
                        notZombie = true;
                    }
                }
            }
        } else {
            for (let i = 0; i < computation.observers!.length; i++) {
                let current = computation.observers![i];
                if (current.flags & Flag.Zombie) {
                    continue;
                }
                current.depsReadyBits -= (1 << computation.observerSlots![i]);
                if (current.depsReadyBits === 0 && propagate(current)) {
                    notZombie = true;
                }
            }
        }
    }
    return notZombie;
}

// function dezombie(computation: Computation | Data) {
//     if (computation.flags & Flag.Zombie) {
//         computation.flags -= Flag.Zombie;
//         if (computation.flags & Flag.Data) {
//             return;
//         }
//         if (computation.flags & Flag.SingleSource) {
//             if ((computation as Computation).source !== null) {
//                 dezombie((computation as Computation).source!);
//             }
//         } else {
//             for (let source of (computation as Computation).sources!) {
//                 dezombie(source);
//             }
//         }
//     }
// }

function watch(data: Data, sideEffect: Function) {
    if (!(data.flags & Flag.HasSideEffect)) {
        data.flags |= Flag.HasSideEffect;
    }
    if(data.flags & Flag.Zombie) {
        data.flags -= Flag.Zombie;
    }
    if (data.flags & Flag.Data) {
        accessData(data);
    } else {
        accessComputation(data as Computation); // because it maybe stale?
    }
    if (data.effect) {
        (data.effects ?? (data.effects = []))
        const watcher = {
            effectFn: sideEffect,
            data: data,
            index: data.effects.length,
            disposed: false
        } as Watcher;
        data.effects.push(watcher);
        return watcher;
    } else {
        data.effect = {
            effectFn: sideEffect,
            data: data,
            index: -1,
            disposed: false
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
    if (accessing.flags & Flag.SingleSource) {
        if (accessing.source === null) {
            accessing.source = source;
            accessing.sourceSlot = insertNewObserver(source, accessing, -1);
        } else {
            accessing.flags -= Flag.SingleSource;
            // notify relocation
            if (accessing.source!.flags & Flag.SingleObserver) {
                accessing.source!.observerSlot! = 0;
            } else {
                accessing.source!.observerSlots![accessing.sourceSlot!] = 0;
            }
            accessing.sources! = [accessing.source!];
            accessing.sourceSlots! = [accessing.sourceSlot!];
            accessing.source = null;
            accessing.sourceSlot = -1;
            return insertNewSource(accessing, source);
        }
    } else {
        accessing.sources!.push(source);
        accessing.sourceSlots!.push(insertNewObserver(source, accessing, accessing.sourceSlots!.length));
    }
}

function insertNewObserver(accesed: Data, observer: Computation, atWhichSlotOfObserver: number): number {
    if (accesed.flags & Flag.SingleObserver) {
        if (accesed.observer === null) {
            accesed.observer! = observer;
            accesed.observerSlot! = atWhichSlotOfObserver;
            return -1;
        } else {
            accesed.flags -= Flag.SingleObserver;
            if (accesed.observer!.flags & Flag.SingleSource) {
                accesed.observer!.sourceSlot! = 0;
            } else {
                accesed.observer!.sourceSlots![accesed.observerSlot!] = 0;
            }
            accesed.observers! = [accesed.observer!];
            accesed.observerSlots! = [accesed.observerSlot!];
            accesed.observer = null;
            accesed.observerSlot = -1;
            return insertNewObserver(accesed, observer, atWhichSlotOfObserver);
        }
    } else {
        accesed.observers!.push(observer);
        accesed.observerSlots!.push(atWhichSlotOfObserver);
        return accesed.observerSlots!.length - 1;
    }
}

function createData<T>(value: T): Data<T> {
    return {
        flags: Flag.Data | Flag.SingleObserver | Flag.Zombie,
        effect: null,
        effects: null,
        observer: null,
        observerSlot: -1,
        observers: null,
        observerSlots: null,
        value,
    };
}

function createComputation<T>(fn: () => T, options?: {
    static: boolean,
    sources?: Data[]
}) {
    const ret: Computation<T> = {
        flags: Flag.Computation | Flag.SingleSource | Flag.SingleObserver | Flag.Zombie | Flag.MaybeStale | Flag.Dynamic | Flag.NotReady,
        effect: null,
        effects: null,
        observer: null,
        observerSlot: -1,
        observers: null,
        observerSlots: null,
        value: null,
        source: null,
        sourceSlot: -1,
        sources: null,
        sourceSlots: null,
        collect: fn,
        depsReadyBits: 0,
        checkIndex: 0
    };
    // ret.value = collectSourceAndRecomputeComputation(ret);
    if (options?.static) {
        // if source is ready: give it ready.
        ret.flags |= Flag.Stable;
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
    cleanupComputation
}