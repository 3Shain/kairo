import {
    createComputation,
    createData,
    accessData,
    accessComputation,
    watch,
    disposeWatcher,
    cleanupComputation,
    Flag,
    setData as _setData,
    runInTransaction,
    Data,
} from './behavior';

describe('core/behavior', () => {
    var noop = () => {};

    const setData = (a: Data<any>, v: number) => _setData(a, v, true);

    it('should establish a reactive relation', (done) => {
        const a = createData(0);
        const b = createData(0);
        const c = createComputation(() => accessData(a) + accessData(b));
        const d = createComputation(() => accessData(a) + accessData(b));
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
        const e = createComputation(() => accessData(c) + accessData(d), {
            static: true,
        });
        const watcher3 = watch(e, noop);
        expect(e.flags & Flag.Zombie).toBeFalsy();
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

        done();
    });

    it('cleanupComputaion do clean up', (done) => {
        const a = createData(0);
        const b = createData(0);
        const c = createComputation(() => accessData(a) + accessData(b));
        const watcher = watch(c, () => {
            expect(c.flags & Flag.MarkForCheck).toBeFalsy();
        });
        cleanupComputation(c, 0);
        expect(c.last_source).toEqual(null);
        expect(a.last_observer).toEqual(null);

        disposeWatcher(watcher);
        done();
    });

    it('cleanupComputaion do clean up for single source computation', () => {
        const a = createData(0);
        const c = createComputation(() => accessData(a));
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
        const a = createData(0);
        const b = createData(1);
        const c = createComputation(() => accessData(a) + accessData(b));
        const d = createComputation(() => accessData(a));
        const e = createComputation(() => accessData(a));
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

    it('runInTransaction guarantees consistancy', () => {
        const a = createData(0);
        const b = createData(0);
        const c = createComputation(() => accessData(a) + accessData(b));
        // const watcher = watch(c, () => {
        //     expect(c.flags & Flag.MaybeStale).toBeFalsy();
        // });
        runInTransaction(() => {
            setData(a, 1);
            expect(c.value).toEqual(null);
            setData(b, 2);
            expect(c.value).toEqual(null);
        });
        expect(c.value).toEqual(null); //

        expect(c.flags & Flag.MarkForCheck).toBeTruthy(); // because it is zombie ...

        expect(accessComputation(c)).toEqual(3); // accessComputation doesn't changes 'markforcheck'
        expect(c.flags & Flag.MarkForCheck).toBeTruthy();
    });

    it('runInTransaction guarantees consistancy', () => {
        const a = createData(0);
        const b = createData(0);
        const c = createComputation(() => accessData(a) + accessData(b));

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
        const a = createData(1);
        const b = createData(2);
        const c = createComputation(() => accessData(a) + accessData(b));
        const d = createComputation(() => accessData(a));
        const e = createComputation(
            () => accessComputation(c) + accessComputation(d)
        );
        expect(c.flags & Flag.NotReady).toBeFalsy();
        expect(accessComputation(c)).toEqual(3);
        expect(accessComputation(d)).toEqual(1);
        // expect(c.flags & Flag.NotReady).toBeFalsy();
        expect(c.flags & Flag.MaybeStable).toBeTruthy();
        const watcher = watch(e, noop);
        setData(a, 2);
        disposeWatcher(watcher);
    });

    it('2', () => {
        const a = createData(1);
        const b = createData(2);
        const c = createComputation(() => {
            if (accessData(a)) {
                return accessData(b);
            }
            return 0;
        });
        const d = createComputation(() => (a.value ? accessData(a) : 0));
        const e = createComputation(
            () => accessComputation(c) + accessComputation(d)
        );
        const watcher = watch(e, noop);
        setData(a, 0);
        disposeWatcher(watcher);
    });

    it('3', () => {
        const a = createData(1);
        const b = createData(2);
        const c = createComputation(() => {
            if (!accessData(a)) {
                return accessData(b);
            }
            return 0;
        });
        const d = createComputation(() => (a.value ? 0 : accessData(a)));
        const e = createComputation(
            () => accessComputation(c) + accessComputation(d)
        );
        const watcher = watch(e, noop);
        setData(a, 0);
        disposeWatcher(watcher);
    });

    it('4', () => {
        const a = createData(1);
        const b = createData(2);
        const c = createComputation(() => {
            if (!accessData(a)) {
                return accessData(b);
            }
            return accessData(a);
        });
        const d = createComputation(() =>
            a.value ? accessData(b) : accessData(a)
        );
        const e = createComputation(
            () => accessComputation(c) + accessComputation(d)
        );
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
});
