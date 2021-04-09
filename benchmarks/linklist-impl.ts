import {
    accessComputation,
    accessData,
    createComputation,
    createData,
    runInTransaction,
    setData,
    watch,
} from '../libs/kairo/src/lib/core/behavior-linklist';
import { Bridge } from './common';

export const KairoLinkInternalStatic: Bridge = {
    cell(initial) {
        const data = createData(initial);
        return {
            read: () => accessData(data),
            write: (w) => setData(data, w),
        };
    },
    computed: (fn) => {
        const d = createComputation(fn, { static: true });
        return {
            read: () => accessComputation(d),
        };
    },
    watch: (read, effect) => {
        const g = createComputation(read, { static: true });
        watch(g, effect);
        effect(read());
        return () => {};
    },
    batch: (fn) => {
        runInTransaction(fn);
    },
    root: (fn) => {
        fn();
    },
};

export const KairoLinkInternal: Bridge = {
    cell(initial) {
        const data = createData(initial);
        return {
            read: () => accessData(data),
            write: (w) => setData(data, w),
        };
    },
    computed: (fn) => {
        const d = createComputation(fn);
        return {
            read: () => accessComputation(d),
        };
    },
    watch: (read, effect) => {
        const g = createComputation(read);
        watch(g, effect);
        effect(read());
        return () => {};
    },
    batch: (fn) => {
        runInTransaction(fn);
    },
    root: (fn) => {
        fn();
    },
};
