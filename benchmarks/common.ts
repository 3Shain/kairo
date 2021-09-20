import {
  computed,
  mutValue as data,
  batch,
  reaction as kairoReaction,
} from '../libs/kairo/src/lib/public-api';
import {
  ref,
  computed as vComputed,
  effect as vEffect,
  ReactiveEffect,
} from '@vue/reactivity';
import S from 's-js';

import {
  createRoot,
  createSignal,
  createMemo as createMemoSolid,
  batch as sBatch,
  createComputed,
  // @ts-ignore
} from '../../../node_modules/solid-js/dist/solid.cjs';
import {
  accessValue,
  createMemo,
  createData as createData,
  setData,
  createReaction,
  executeReaction,
  cleanupComputation,
} from '../libs/kairo/src/lib/cell/internal';

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
    S(() => {
      read();
      effect();
    });
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

export const VueScheduledBridge = {
  cell: (initial) => {
    const data = ref(initial);
    return {
      read() {
        return data.value as any;
      },
      write(v) {
        VueScheduledBridge.batch(() => {
          data.value = v as any;
        });
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
  watch: function (read, effect) {
    let t = vEffect(
      () => {
        read();
        effect();
      },
      {
        lazy: false,
        scheduler: (x) => {
          this.scheduled.push(t.effect);
        },
      }
    );
    return t;
  },
  scheduled: [] as ReactiveEffect[],
  isBatching: false,
  batch: function (fn) {
    if (this.isBatching) {
      fn();
    }
    this.isBatching = true;
    fn();
    while (this.scheduled.length) {
      this.scheduled.pop().run();
    }
    this.isBatching = false;
  },
  root: (fn) => {
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
    const read = createMemoSolid(fn);
    return {
      read,
    };
  },
  watch: (read, effect) => {
    let first = false;
    createComputed(() => {
      read();
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
    const disposer = reaction(read, effect, { fireImmediately: true });
    return () => {
      disposer();
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
    const fn = () => {
      effect();
      g.execute(read);
    };
    const g = kairoReaction(fn);
    fn();
    return () => {
      g.dispose();
    };
  },
  batch: (fn) => {
    batch(fn);
  },
  root: (fn) => {
    fn();
  },
};

export const KairoInternal: Bridge = {
  cell(initial) {
    const data = createData(initial);
    return {
      read: () => accessValue(data),
      write: (w) => setData(data, w),
    };
  },
  computed: (fn) => {
    const d = createMemo(fn);
    return {
      read: () => accessValue(d),
    };
  },
  watch: (read, effect) => {
    const fn = () => {
      effect();
      executeReaction(g, read);
    };
    const g = createReaction(fn);
    fn();
    return () => {
      cleanupComputation(g);
    };
  },
  batch: (fn) => {
    batch(fn);
  },
  root: (fn) => {
    fn();
  },
};

export function assert(exp: any, value: any) {
  if (exp !== value) throw Error('Assertation failed');
}

export function callAtLeast(time: number = 1, allowMore: boolean = false) {
  let count = 0;

  return {
    call: () => {
      count++;
      if (count > time && !allowMore)
        console.log(`More call than expected. Expect ${time} got ${count}`);
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

export type Case = (bridge: Bridge) => () => any;
