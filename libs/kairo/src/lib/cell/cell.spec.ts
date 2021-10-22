import { from, Observable } from 'rxjs';
import { computed, mutable, Cell, Reaction, combined } from './cell';
import { batch, BitFlags, Memo, untrack } from './internal';

describe('cell', () => {

  beforeAll(()=>{
    globalThis.Observable = Observable;
  });

  afterAll(()=>{
    globalThis.Observable = undefined;
  })

  it('normal', () => {
    const [a, ma] = mutable(0);
    const b = computed(() => a.value);
    let g = 0;
    effect(() => (g = b.value));
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countSources(b)).toBe(1);
    ma(1);
    expect(g).toBe(1);
  });

  it('eager evaluate', () => {
    const [a, ma] = mutable(0);
    const b = computed(() => a.value);
    b.value;
    expect(countObservers(a)).toBe(1);
    expect(countSources(b)).toBe(1);
    ma(1);
    expect(countObservers(a)).toBe(0);
    expect(countSources(b)).toBe(0);
    expect(hasFlag(b, BitFlags.StaleMemo)).toBeTruthy();
  });

  it('self reference should throw', () => {
    const a = computed(() => {
      a.value;
      return 1;
    });
    expect(() => a.value).toThrow(ReferenceError);
  });

  it('circular reference should throw', () => {
    const a = computed(() => {
      b.value;
      return 1;
    });
    const b = computed(() => {
      a.value;
      return 1;
    });
    expect(() => a.value).toThrow(ReferenceError);
    expect(() => b.value).toThrow(ReferenceError);
  });

  it('unstable 1', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const [c, mc] = mutable(0);
    const d = computed(() => {
      if (a.value) {
        b.value, c.value;
      }
      return 1;
    });
    effect(() => d.value);
    expect(countSources(d)).toBe(1);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(0);
    expect(countObservers(c)).toBe(0);
    ma(1);
    expect(countSources(d)).toBe(3);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countObservers(c)).toBe(1);
    ma(0);
    expect(countSources(d)).toBe(1);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(0);
    expect(countObservers(c)).toBe(0);
  });

  it('unstable 2', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const [c, mc] = mutable(0);
    const d = computed(() => {
      if ((a.value, a.value)) {
        b.value, c.value;
      } else {
        c.value, b.value;
      }
      return 1;
    });
    effect(() => d.value);
    expect(countSources(d)).toBe(3);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countObservers(c)).toBe(1);
    ma(1);
    expect(countSources(d)).toBe(3);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countObservers(c)).toBe(1);
    ma(0);
    expect(countSources(d)).toBe(3);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countObservers(c)).toBe(1);
  });

  it('unstable 3', () => {
    const [a, ma] = mutable(0);
    const b = Cell.of(0);
    const c = computed(() => a.value + b.value);
    const e = computed(() => c.value);
    const d = computed(() => {
      if (a.value) {
        b.value;
      } else {
        e.value;
      }
      return 1;
    });
    effect(() => c.value);
    effect(() => d.value);
    // expect(countSources(d)).toBe(3);
    // expect(countObservers(a)).toBe(1);
    // expect(countObservers(b)).toBe(1);
    // expect(countObservers(c)).toBe(1);
    ma(1);
    // expect(countSources(d)).toBe(3);
    // expect(countObservers(a)).toBe(1);
    // expect(countObservers(b)).toBe(1);
    // expect(countObservers(c)).toBe(1);
    ma(0);
    // expect(countSources(d)).toBe(3);
    // expect(countObservers(a)).toBe(1);
    // expect(countObservers(b)).toBe(1);
    // expect(countObservers(c)).toBe(1);
  });

  it('', () => {
    const [a, ma] = mutable(0);
    const b = Cell.of(0);
    const c = computed(() => {
      a.value, b.value;
      throw Error('Stub');
    });

    effect(() => c.error);
    ma(1);
    ma(0);
  });

  it('self-destroying computation?', () => {
    let closure = 1;
    const [a, ma] = mutable(0);
    const b = computed(() => {
      if (closure) {
        a.value;
      }
      return 1;
    });

    effect(() => b.value);
    ma(1);
    closure = 0;
    ma(0);
    expect(countObservers(a)).toBe(0);
    expect(countSources(b)).toBe(0);
    expect(countObservers(b)).toBe(1);
  });

  it('untrack', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const [c, mc] = mutable(0);
    const d = computed(() => {
      if (a.value) {
        b.value, untrack(() => c.value);
      }
      return 1;
    });
    effect(() => d.value);
    expect(countSources(d)).toBe(1);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(0);
    expect(countObservers(c)).toBe(0);
    ma(1);
    expect(countSources(d)).toBe(2);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countObservers(c)).toBe(0);
    ma(0);
    expect(countSources(d)).toBe(1);
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(0);
    expect(countObservers(c)).toBe(0);
  });

  it('batch', () => {});

  it('interop observable', () => {
    const [a, ma] = mutable(0);
    const interopObservable = from(a);

    let o = 0;
    const subscription = interopObservable.subscribe({
      next: (v) => {
        o = v;
      },
    });
    const num = Math.random();
    ma(num);
    subscription.unsubscribe();
    expect(o).toBe(num);
  });

  it('interop observable (function)', () => {
    const [a, ma] = mutable(0);

    let o = 0;
    const subscription = a.subscribe((v) => {
      o = v;
    });
    const num = Math.random();
    ma(num);
    subscription.unsubscribe();
    expect(o).toBe(num);
  });

  it('combined object', () => {
    const [a] = mutable(0);

    const combinedCell = combined({
      prop1: 0,
      prop2: a,
      prop3: {
        prop4: a,
      },
    });
    expect(combinedCell.value).toStrictEqual({
      prop1: 0,
      prop2: 0,
      prop3: {
        prop4: a,
      },
    });
  });

  it('combined array', () => {
    const [a] = mutable(0);

    const combinedCell = combined([0, a, { prop: a }]);
    expect(combinedCell.value).toStrictEqual([0, 0, { prop: a }]);
  });

  afterEach(cleanup);
});

const toCleanup: Function[] = [];

export function cleanup() {
  toCleanup.forEach((x) => x());
  toCleanup.length = 0;
}

export function effect(fn: () => any) {
  const callback = () => {
    r.track(fn);
  };
  const r = new Reaction(callback);
  callback();
  toCleanup.push(() => r.dispose());
}

export function controlledEffect(fn: () => any) {
  const callback = () => {
    r.track(fn);
  };
  const r = new Reaction(callback);
  callback();
  return () => r.dispose();
}

export function countObservers(cell: Cell<any>) {
  let count = 0,
    lo = cell['internal'].lo;
  while (lo) {
    count++;
    lo = lo.prev;
  }
  return count;
}

export function countSources(cell: Cell<any>) {
  let count = 0,
    lo = (cell['internal'] as Memo).ls;
  while (lo) {
    count++;
    lo = lo.prev;
  }
  return count;
}

export function hasFlag(cell: Cell<any>, flag: BitFlags) {
  return cell['internal'].flags & flag;
}
