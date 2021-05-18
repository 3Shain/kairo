import {
    createComputation as compute,
    createData as data,
    accessData as readData,
    accessComputation as readCompute,
    watch,
    disposeWatcher,
    cleanupComputation,
    Flag,
    setData as _setData,
    runInTransaction,
    Data,
    untrack,
    createLazy,
    executeLazy,
} from './behavior';

/**
 * TODO: add comments explaining all the mechanism
 * MaybeStale/Stale
 * MaybeStable/Stable/Unstable
 * RenderEffect
 * Zombie
 * MarkForCheck
 */

describe('core/behavior', () => {
    var noop = () => {};

    const setData = (a: Data<any>, v: number) => _setData(a, v, true);

    it('should establish a reactive relation', () => {
        const a = data(0);
        const b = data(0);
        const c = compute(() => readData(a) + readData(b));
        const d = compute(() => readData(a) + readData(b));
        let result = 0;
        const watcher = watch(c, () => {
            expect(c.flags & Flag.MarkForCheck).toBeFalsy();
            result = c.value;
        });
        let result2 = 0;
        const watcher2 = watch(d, () => {
            expect(d.flags & Flag.MarkForCheck).toBeFalsy();
            result2 = d.value;
        });
        const e = compute(() => readData(c) + readData(d), {
            static: true,
        });
        const watcher3 = watch(e, noop);
        expect(e.flags & Flag.Stale).toBeFalsy();
        expect(e.last_source).toBeTruthy();

        setData(a, 1);
        expect(result).toEqual(1);
        expect(result2).toEqual(1);

        setData(b, 2);
        expect(result).toEqual(3);
        expect(result2).toEqual(3);

        expect(c.flags & Flag.MarkForCheck).toBeFalsy();
        expect(d.flags & Flag.MarkForCheck).toBeFalsy();
        expect(e.depsCounter).toEqual(0);
        expect(e.flags & Flag.MarkForCheck).toBeFalsy();
        expect(e.value).toEqual(6);

        disposeWatcher(watcher3);
        disposeWatcher(watcher);
        disposeWatcher(watcher2);
    });

    it('cleanupComputaion do clean up', () => {
        const a = data(0);
        const b = data(0);
        const c = compute(() => readData(a) + readData(b));
        const watcher = watch(c, () => {
            expect(c.flags & Flag.MarkForCheck).toBeFalsy();
        });
        cleanupComputation(c, 0);
        expect(c.last_source).toEqual(null);
        expect(a.last_observer).toEqual(null);

        disposeWatcher(watcher);
    });

    it('cleanupComputaion do clean up for single source computation', () => {
        const a = data(0);
        const c = compute(() => readData(a));
        const watcher = watch(c, () => {
            expect(c.flags & Flag.MarkForCheck).toBeFalsy();
        });
        expect(c.last_source.source === a).toBeTruthy();
        cleanupComputation(c, 0);
        expect(c.last_source === null).toBeTruthy();
        expect(a.last_observer === null).toBeTruthy();

        disposeWatcher(watcher);
    });

    it('cleanupComputaion do clean up for single source computation', () => {
        const a = data(0);
        const b = data(1);
        const c = compute(() => readData(a) + readData(b));
        const d = compute(() => readData(a));
        const e = compute(() => readData(a));
        const watcher = watch(c, noop);
        const watcher2 = watch(d, noop);
        const watcher3 = watch(e, noop);
        expect(d.last_source.source === a).toBeTruthy();
        cleanupComputation(d, 0);
        cleanupComputation(e, 0);
        cleanupComputation(c, 0);
        expect(d.last_source === null).toBeTruthy();
        expect(a.last_observer === null).toBeTruthy();

        disposeWatcher(watcher);
        disposeWatcher(watcher2);
        disposeWatcher(watcher3);
    });

    it('no propagation if no watcher', () => {
        const a = data(0);
        const b = data(0);
        const c = compute(() => readData(a) + readData(b));
        runInTransaction(() => {
            setData(a, 1);
            setData(a, 1); // redunant set.
            setData(b, 2);
        });
        expect(c.value).toEqual(undefined); // change is not propagated
        expect(c.flags & Flag.Stale).toBeTruthy();

        expect(readCompute(c)).toEqual(3); // accessComputation
        expect(c.flags & Flag.Stale).toBeFalsy(); // now it's active (but might be disposed later.)
    });

    it('runInTransaction guarantees consistancy', () => {
        const a = data(0);
        const b = data(0);
        const c = compute(() => readData(a) + readData(b));

        const watcher = watch(c, () => {
            /**noop */
        });

        runInTransaction(() => {
            setData(a, 1);
            expect(c.value).toEqual(0);
            setData(b, 2);
            expect(c.value).toEqual(0);
        });

        expect(c.value).toEqual(3);
        expect(c.flags & Flag.MarkForCheck).toBeFalsy();

        disposeWatcher(watcher);
    });

    it('1', () => {
        const a = data(1);
        const b = data(2);
        const c = compute(() => readData(a) + readData(b));
        const d = compute(() => readData(a));
        const e = compute(() => readCompute(c) + readCompute(d));
        expect(c.flags & Flag.NotReady).toBeFalsy();
        expect(readCompute(c)).toEqual(3);
        expect(readCompute(d)).toEqual(1);
        // expect(c.flags & Flag.NotReady).toBeFalsy();
        expect(c.flags & Flag.MaybeStable).toBeTruthy();
        const watcher = watch(e, noop);
        setData(a, 2);
        disposeWatcher(watcher);
    });

    it('2', () => {
        const a = data(1);
        const b = data(2);
        const c = compute(() => {
            if (readData(a)) {
                return readData(b);
            }
            return 0;
        });
        const d = compute(() => (a.value ? readData(a) : 0));
        const e = compute(() => readCompute(c) + readCompute(d));
        const watcher = watch(e, noop);
        setData(a, 0);
        disposeWatcher(watcher);
    });

    it('3', () => {
        const a = data(1);
        const b = data(2);
        const c = compute(() => {
            if (!readData(a)) {
                return readData(b);
            }
            return 0;
        });
        const d = compute(() => (a.value ? 0 : readData(a)));
        const e = compute(() => readCompute(c) + readCompute(d));
        const watcher = watch(e, noop);
        setData(a, 0);
        disposeWatcher(watcher);
    });

    it('4', () => {
        const a = data(1);
        const b = data(2);
        const c = compute(() => {
            if (!readData(a)) {
                return readData(b);
            }
            return readData(a);
        });
        const d = compute(() => (a.value ? readData(b) : readData(a)));
        const e = compute(() => readCompute(c) + readCompute(d));
        const watcher = watch(e, noop);
        setData(a, 0);
        expect(c.value).toBe(2);
        expect(c.flags & Flag.MarkForCheck).toBeFalsy();
        expect(c.flags & Flag.MaybeStable).toBeFalsy();
        setData(b, 0);
        expect(d.value).toBe(0);
        expect(e.value).toBe(0);
        expect(b.last_observer.prev_observer).toBeFalsy();
        expect(e.flags & Flag.MaybeStable).toBeTruthy();
        disposeWatcher(watcher);
    });

    it('zombie relationship', () => {
        const a = data(0);
        const b = data(0);

        const keep_a_b_alive = compute(() => readData(a) + readData(b));
        const keep_a_b_alive_watcher = watch(keep_a_b_alive, noop);

        const c = compute(() => readData(a) + readData(b));
        const d = compute(() => readData(a));
        const e = compute(() => readCompute(c) + readCompute(d));
        const watcher = watch(e, noop);
        setData(a, 1);
        setData(b, 2);
        expect(c.value).toBe(3);
        disposeWatcher(watcher);
        setData(a, 0);
        setData(b, 2);
        // expect(c.flags & Flag.Zombie).toBeTruthy(); // c is not zombie yet
        setData(a, 1);
        expect(c.flags & Flag.Stale).toBeTruthy();

        disposeWatcher(keep_a_b_alive_watcher);
    });

    it('untrack', () => {
        const a = data(1);
        const b = compute(() => untrack(() => a.value));

        const watcher = watch(b, noop);

        setData(a, 2);

        expect(b.value).toBe(1);

        disposeWatcher(watcher);
    });

    it('unchanged computation', () => {
        const a = data(1);
        const b = data(2);
        const c = compute(() => {
            readData(a);
            return 0;
        });
        const d = compute(() => readData(b));
        const e = compute(() => readCompute(c) + readCompute(d));

        const watcher1 = watch(e, noop);
        const watcher2 = watch(e, noop);
        const watcher3 = watch(e, noop);

        setData(a, 2); // should propagate c but makes no effect.

        disposeWatcher(watcher3); // dispose in different order.
        disposeWatcher(watcher1);
        disposeWatcher(watcher2);
    });

    // it('renderEffect should works', () => {
    //     let effectCount = 0;

    //     const reff = createRenderEffect(() => {
    //         effectCount++;
    //     });

    //     const a = data(1);
    //     const b = data(2);

    //     const result = executeRenderEffect(reff, () => {
    //         return readData(a) + readData(b);
    //     });

    //     expect(result).toBe(3);

    //     setData(a, 2);
    //     setData(b, 3);

    //     expect(effectCount).toBe(2);

    //     setData(b, 3);
    //     const result2 = executeRenderEffect(reff, () => {
    //         return readData(a);
    //     });

    //     expect(result2).toBe(2);

    //     setData(a, 4);

    //     const result3 = executeRenderEffect(reff, () => {
    //         return readData(b);
    //     });
    //     const result4 = executeRenderEffect(reff, () => {
    //         return readData(b);
    //     }); // memo result

    //     expect(result3).toBe(3);
    //     expect(result3).toBe(result4);
    //     // expect(effectCount).toBe(3);

    //     expect(reff.flags & Flag.Unstable).toBeTruthy();

    //     setData(b,0);

    //     // executeRenderEffect will not eager update if it is not stale (marked stale by previous dependencies)
    //     const result5 = executeRenderEffect(reff, () => {
    //         return readData(a);
    //     }); // memo result
    //     expect(result5).toBe(4);

    //     cleanupRenderEffect(reff);
    // });

    it('self referenced computation', () => {
        const a = data(1);
        const c = compute(
            () => {
                if (readCompute(c) < 10) {
                    return readCompute(c) + readData(a);
                }
                return readCompute(c);
            },
            { initial: 0 }
        );

        const watcher1 = watch(c, noop);

        disposeWatcher(watcher1);
        console.log(c);
    });
});
