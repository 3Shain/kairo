import { from, Observable } from 'rxjs';
import {
  computed,
  mutable,
  Cell,
  combined,
  IncrementalReaction,
} from './cell';
import { batch, BitFlags, Memo, untrack } from './internal';
import {
  effect,
  countObservers,
  countSources,
  hasFlag,
  cleanup,
} from './spec-shared';

describe('cell', () => {
  beforeAll(() => {
    globalThis.Observable = Observable;
  });

  afterAll(() => {
    globalThis.Observable = undefined;
  });

  it('normal', () => {
    const [a, ma] = mutable(0);
    const b = computed(() => a.$);
    let g = 0;
    effect(() => (g = b.$));
    expect(countObservers(a)).toBe(1);
    expect(countObservers(b)).toBe(1);
    expect(countSources(b)).toBe(1);
    ma(1);
    expect(g).toBe(1);
  });

  it('eager evaluate', () => {
    const [a, ma] = mutable(0);
    const b = computed(() => a.$);
    b.current;
    expect(countObservers(a)).toBe(1);
    expect(countSources(b)).toBe(1);
    ma(1);
    expect(countObservers(a)).toBe(0);
    expect(countSources(b)).toBe(0);
    expect(hasFlag(b, BitFlags.StaleMemo)).toBeTruthy();
  });

  it('self reference should throw', () => {
    const a = computed(() => {
      a.$;
      return 1;
    });
    expect(() => a.current).toThrow(ReferenceError);
  });

  it('circular reference should throw', () => {
    const a = computed(() => {
      b.$;
      return 1;
    });
    const b = computed(() => {
      a.$;
      return 1;
    });
    expect(() => a.current).toThrow(ReferenceError);
    expect(() => b.current).toThrow(ReferenceError);
  });

  it('circular reference should throw (ref)', () => {
    const a = computed(() => {
      b.$;
      return 1;
    });
    const b = computed(() => {
      a.current;
      return 1;
    });
    expect(() => a.current).toThrow(ReferenceError);
    expect(() => b.current).toThrow(ReferenceError);
  });

  it('unstable 1', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const [c, mc] = mutable(0);
    const d = computed(() => {
      if (a.$) {
        b.$, c.$;
      }
      return 1;
    });
    effect(() => d.$);
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
      if ((a.$, a.$)) {
        b.$, c.$;
      } else {
        c.$, b.$;
      }
      return 1;
    });
    effect(() => d.$);
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
    const c = computed(() => a.$ + b.$);
    const e = computed(() => c.$);
    const d = computed(() => {
      if (a.$) {
        b.$;
      } else {
        e.$;
      }
      return 1;
    });
    effect(() => c.$);
    effect(() => d.$);
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

  it('throw in computed', () => {
    const p = new Error('Stub');
    const [a, ma] = mutable(0);
    const b = Cell.of(0);
    const c = computed(() => {
      a.$, b.$;
      throw p;
    });

    effect(() => {
      try {
        c.$;
      } catch (e) {
        expect(e).toBe(p);
      }
    });
    ma(1);
    ma(0);
  });

  it('self-destroying computation?', () => {
    let closure = 1;
    const [a, ma] = mutable(0);
    const b = computed(() => {
      if (closure) {
        a.$;
      }
      return 1;
    });

    effect(() => b.$);
    ma(1);
    closure = 0;
    ma(0);
    expect(countObservers(a)).toBe(0);
    expect(countSources(b)).toBe(0);
    expect(countObservers(b)).toBe(1);
  });

  it('unchanged computed', () => {
    const [a, ma] = mutable(0);
    const p = Math.random();
    const b = computed(() => {
      a.$;
      return p;
    });
    const c = computed(() => b.$);

    effect(() => {
      expect(c.$).toBe(p);
    });
    ma(1);
    ma(2);
  });

  it('untrack', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const [c, mc] = mutable(0);
    const d = computed(() => {
      if (a.$) {
        b.$, untrack(() => c.current);
      }
      return 1;
    });
    effect(() => d.$);
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

  describe('Cell.subscribe()', () => {
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

    it('interop observable (error)', () => {
      const num = Math.random();
      const [a, ma] = mutable(0);
      const b = computed(() => {
        if (a.$) {
          throw a.$;
        }
        return 0;
      });
      const interopObservable = from(b);

      let o = 0;
      const subscription = interopObservable.subscribe({
        error: (v) => {
          o = v;
        },
      });
      ma(num);
      // subscription.unsubscribe();
      expect(subscription.closed).toBeTruthy();
      expect(o).toBe(num);
    });
  });

  describe('combined()', () => {
    it('combined object', () => {
      const [a] = mutable(0);

      const combinedCell = combined({
        prop1: 0,
        prop2: a,
        prop3: {
          prop4: a,
        },
      });
      expect(combinedCell.current).toStrictEqual({
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
      expect(combinedCell.current).toStrictEqual([0, 0, { prop: a }]);
    });
  });

  describe('batch()', () => {
    it('internal mutation work as it is', () => {
      const [a, ma] = mutable(0);
      const b = computed(() => a.$);

      let g = 0;
      effect(() => (g = b.$));

      batch(() => {
        ma(1);
        expect(b.current).toBe(1);
        batch(() => {
          ma(3);
          ma((x) => x - 1);
        });
      });
      expect(g).toBe(2);
    });
  });

  describe('IncrementalReaction', () => {
    it('should work as expect', () => {
      const [a, ma] = mutable(0);
      const [b, mb] = mutable(0);
      const fn = jest.fn();
      const reaction = new IncrementalReaction(fn);
      reaction.track(() => a.$);
      ma(1);
      mb(1);
      expect(fn).toBeCalledTimes(1);
      reaction.continue(() => (a.$, b.$));
      ma(1);
      mb(1);
      expect(fn).toBeCalledTimes(3);
      reaction.dispose();
      ma(1);
      mb(1);
      expect(fn).toBeCalledTimes(3);
    });
  });

  afterEach(cleanup);
});
