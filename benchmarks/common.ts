import {
  computed,
  mutValue as data,
  Scope,
  transaction,
} from '../libs/kairo/src';
import { ref, computed as vComputed, effect as vEffect } from '@vue/reactivity';
import S from 's-js';

import {
  createRoot,
  createSignal,
  createMemo,
  batch as sBatch,
  createComputed,
  // @ts-ignore
} from '../../../node_modules/solid-js/dist/solid.cjs';
import {
  accessComputation,
  accessData,
  createComputation,
  createData,
  runInTransaction,
  setData,
  watch,
} from '../libs/kairo/src/lib/cell';

import {
  observable,
  computed as mbxComputed,
  reaction,
  transaction as mtrs,
  action as mbxAction,
} from 'mobx';

export interface ReadableCell<T> {
  read(): T;
}

export interface WriteableCell<T> extends ReadableCell<T> {
  write(v: T): void;
}

export interface Bridge {
  cell<T>(value: T): WriteableCell<T>;
  computed<T>(fn: () => T): ReadableCell<T>;
  watch<T>(read: () => T, effect: () => void): () => void;
  batch(fn: () => void): void;
  root(fn: () => void): void;
}

export const SBridge: Bridge = {
  cell: (initial) => {
    const data = S.value(initial);
    return {
      read() {
        return data();
      },
      write(v) {
        data(v);
      },
    };
  },
  computed: (fn) => {
    const computed = S(fn);
    return {
      read() {
        return computed();
      },
    };
  },
  watch: (read, effect) => {
    S.on(
      read,
      (x) => {
        effect();
        return x;
      },
      undefined,
      true
    );
    return () => {};
    // S.effect
  },
  batch: (fn) => {
    S.freeze(fn);
  },
  root: (fn) => {
    S.root(fn);
  },
};

export const VueReactiveBridge: Bridge = {
  cell: (initial) => {
    const data = ref(initial);
    return {
      read() {
        return data.value as any;
      },
      write(v) {
        data.value = v as any;
      },
    };
  },
  computed: (fn) => {
    const c = vComputed(fn);
    return {
      read() {
        return c.value;
      },
    };
  },
  watch: (read, effect) => {
    return vEffect(
      () => {
        return read();
      },
      {
        lazy: false,
        scheduler: (x) => {
          read(); // set _dirty to false, to make it sync.
          effect();
        },
      }
    );
  },
  batch: (fn) => {
    fn(); // no such way
  },
  root: (fn) => {
    // S.root(fn)
    fn(); // no such way
  },
};

export const SolidBridge: Bridge = {
  cell(initial) {
    const [r, w] = createSignal(initial);
    return {
      read: r,
      write: (x) => {
        w(x);
      },
    };
  },
  computed: (fn) => {
    const read = createMemo(fn);
    return {
      read,
    };
  },
  watch: (read, effect) => {
    let first = false;
    createComputed(() => {
      read();
      if (!first) {
        first = true;
        return;
      }
      effect();
    });
    return () => {
      // no disposor
    };
  },
  batch: (fn) => {
    sBatch(fn);
  },
  root: (fn) => {
    createRoot(fn);
  },
};

export const MobxBridge: Bridge = {
  cell(initial) {
    const s = observable.box(initial);
    return {
      read: () => s.get(),
      write: mbxAction((x) => {
        s.set(x);
      }),
    };
  },
  computed: (fn) => {
    const read = mbxComputed(fn);
    return {
      read: () => read.get(),
    };
  },
  watch: (read, effect) => {
    reaction(read, effect, { fireImmediately: false });
    return () => {
      // no disposor
    };
  },
  batch: (fn) => {
    mtrs(fn);
  },
  root: (fn) => {
    // createRoot(fn);
    fn();
  },
};

export const KairoBridge: Bridge = {
  cell(initial) {
    const [b, w] = data(initial);
    return {
      read: () => b.value,
      write: w,
    };
  },
  computed: (fn) => {
    const d = computed(fn);
    return {
      read: () => d.value,
    };
  },
  watch: (read, effect) => {
    const g = computed(read);
    g.watch(effect);
    return () => {};
  },
  batch: (fn) => {
    transaction(fn);
  },
  root: (fn) => {
    const scope = new Scope();
    const end = scope.beginScope();
    fn();
    end();
  },
};

export const KairoInternal: Bridge = {
  cell(initial) {
    const data = createData(initial);
    return {
      read: () => accessData(data),
      write: (w) => setData(data, w, true),
    };
  },
  computed: (fn) => {
    const d = createComputation(fn, { static: false });
    return {
      read: () => accessComputation(d),
    };
  },
  watch: (read, effect) => {
    const g = createComputation(read, { static: false });
    watch(g, effect);
    return () => {};
  },
  batch: (fn) => {
    runInTransaction(fn);
  },
  root: (fn) => {
    fn();
  },
};

export const KairoInternalStatic: Bridge = {
  cell(initial) {
    const data = createData(initial);
    return {
      read: () => accessData(data),
      write: (w) => setData(data, w, true),
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
    return () => {};
  },
  batch: (fn) => {
    runInTransaction(fn);
  },
  root: (fn) => {
    fn();
  },
};

export const KairoStaticBridge: Bridge = {
  cell(initial) {
    const [b, w] = data(initial);
    return {
      read: () => b.value,
      write: w,
    };
  },
  computed: (fn) => {
    const d = computed(fn, {
      static: true,
    });
    return {
      read: () => d.value,
    };
  },
  watch: (read, effect) => {
    const g = computed(read, {
      static: true,
    });
    g.watch(effect);
    return () => {};
  },
  batch: (fn) => {
    transaction(fn);
  },
  root: (fn) => {
    const scope = new Scope();
    const end = scope.beginScope();
    fn();
    end();
  },
};


export function assert(exp: any, value: any) {
  if (exp !== value) throw Error('Assertation failed');
}

export function callAtLeast(time: number = 1,allowMore:boolean = false) {
  let count = 0;

  return {
    call: () => {
      count++;
      if (count > time&&!allowMore) console.log(`More call than expected. Expect ${time} got ${count}`);
    },
    assert: () => {
      if (count < time) {
        throw Error(`Not enough call. Expect ${time} got ${count}`);
      }
    },
  };
}

export function busy() {
  let a = 0;
  for (let i = 0; i < 1_00; i++) {
    a++;
  }
}

export type Case = (bridge:Bridge)=>()=>any;