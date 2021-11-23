import { from, Observable } from 'rxjs';
import {
  computed,
  mutable,
  Cell,
  combined,
  IncrementalReaction,
  Reaction,
} from './cell';
import { batch, BitFlags, Memo, transaction } from './internal';
import {
  effect,
  countObservers,
  countSources,
  hasFlag,
  cleanup,
  internalValue,
} from './spec-shared';

describe('cell', () => {
  beforeAll(() => {
    globalThis.Observable = Observable;
  });

  afterAll(() => {
    globalThis.Observable = undefined;
  });

  it('do not evaluate if dependencies are unchanged', () => {
    const [a, ma] = mutable(0);
    const [b, mb] = mutable(0);
    const c = computed(($) => $(a) + $(b));
    const d = c.map((x) => x);
    let run = false;
    effect(($) => {
      if (run) {
        throw 'Not expected effect';
      }
      $(d);
      run = true;
    });
    batch(() => {
      ma(1);
      mb(-1);
    });
  });

  describe('dynamic dependencies', () => {
    it('|[dependencies]| increase', () => {
      const [a, ma] = mutable(0);
      const b = Cell.of(0);
      let step = 0;
      const c = computed(($) => {
        switch (step) {
          case 0:
            return $(a);
          case 1:
            return $(a), $(b);
        }
      });
      effect(($) => $(c));
      expect(countObservers(b)).toBe(0);
      step = 1;
      ma(1);
      expect(countObservers(b)).toBe(1);
    });

    it("|[dependencies]| increase - edge case: exists 'MarkForCheck in [new dependencies] ", () => {
      const [a, ma] = mutable(0);
      const d = computed(($) => $(a));
      let step = 0;
      let pass = false;
      const c = computed(($) => {
        $(a);
        switch (step) {
          case 0:
            return 0;
          case 1:
            if (!pass) {
              expect(hasFlag(d, BitFlags.MarkForCheck)).toBeTruthy();
              pass = true;
            } else {
              expect(hasFlag(d, BitFlags.MarkForCheck)).toBeFalsy();
            }
            return $(d);
        }
      });
      effect(($) => {
        $(d), $(c); // this order matter
      });
      step = 1;
      batch(() => {
        ma(1);
      });
    });

    it("|[dependencies]| increase - edge case: exists 'Stale in [new dependencies] and it (directly/indirectly) dependes on 'MarkForCheck", () => {
      const [a, ma] = mutable(0);
      const d = computed(($) => $(a));
      const e = computed(($) => $(d));
      let step = 0;
      let pass = false;
      const c = computed(($) => {
        $(a);
        switch (step) {
          case 0:
            return 0;
          case 1:
            if (!pass) {
              expect(hasFlag(e, BitFlags.Stale)).toBeTruthy();
              expect(hasFlag(e, BitFlags.MarkForCheck)).toBeFalsy();
              pass = true;
              try {
                return $(e);
              } catch (err) {
                expect(err).toStrictEqual({});
                throw err;
              }
            } else {
              pass = false;
              expect(hasFlag(e, BitFlags.MarkForCheck)).toBeFalsy();
              return $(e);
            }
        }
      });
      effect(($) => {
        $(d), $(c); // this order does matter!
      });
      step = 1;
      batch(() => {
        ma(1);
      });
      expect(pass).toBe(false);
    });

    it('|[dependencies]| decrease', () => {
      const [a, ma] = mutable(0);
      const b = Cell.of(0);
      let step = 0;
      const c = computed(($) => {
        switch (step) {
          case 0:
            return $(a), $(b);
          case 1:
            return $(a);
        }
      });
      effect(($) => $(c));
      expect(countObservers(b)).toBe(1);
      step = 1;
      ma(1);
      expect(countObservers(b)).toBe(0);
    });

    it('|[dependencies]| decrease - edge case: |[dependencies]| = 0', () => {
      const [a, ma] = mutable(0);
      const [b] = mutable(0);
      let step = 0;
      const c = computed(($) => {
        switch (step) {
          case 0:
            return $(a), $(b);
          case 1:
            return 0;
        }
      });
      effect(($) => $(c));
      expect(countObservers(b)).toBe(1);
      step = 1;
      ma(1);
      expect(countObservers(b)).toBe(0);
      expect(countObservers(a)).toBe(0);
      expect(countSources(c)).toBe(0);
    });

    it('[dependencies] changes', () => {
      const [a, ma] = mutable(0);
      const [b] = mutable(0);
      const [c] = mutable(0);
      let step = 0;
      const d = computed(($) => {
        switch (step) {
          case 0:
            return $(a), $(c);
          case 1:
            return $(a), $(b);
        }
      });
      effect(($) => $(d));
      expect(countObservers(b)).toBe(0);
      expect(countObservers(c)).toBe(1);
      step = 1;
      ma(1);
      expect(countObservers(b)).toBe(1);
      expect(countObservers(c)).toBe(0);
    });
  });

  describe('stateful computed()', () => {
    it('get history', () => {
      const [a, ma] = mutable(0);
      const b: Cell<number> /* type broken? */ = computed(($) => {
        if ($(b) > 10) {
          return $(b);
        }
        return $(a);
      }, 0);
      const cleanEffect = effect(($) => $(b));
      ma(1);
      expect(b.current).toBe(1);
      ma(11);
      expect(b.current).toBe(11);
      ma(2); // b has no source now!
      expect(b.current).toBe(11);
      cleanEffect();
      expect(hasFlag(b, BitFlags.Stale)).toBeTruthy();
      expect(b.current).toBe(11);
    });

    it('get history error', () => {
      const p = new Error('custom');
      const [a, ma] = mutable(0);
      const b: Cell<number> /* type broken? */ = computed(($) => {
        $(a);
        if ($(b) > 10) {
          throw p;
        }
        return $(a);
      }, 0);
      const cleanEffect = effect(($) => {
        $.error(b);
      });
      ma(1);
      expect(b.current).toBe(1);
      ma(11);
      expect(b.current).toBe(11);

      ma(2);
      expect(() => b.current).toThrow(p);
      ma(3);
      expect(() => b.current).toThrow(p);
      cleanEffect();
      expect(hasFlag(b, BitFlags.Stale)).toBeTruthy();
      expect(() => b.current).toThrow(p);
    });
  });

  describe('circular dependency', () => {
    it('circular reactive reference should throw', () => {
      const a = computed(($) => {
        $(b);
        return 1;
      });
      const b = computed(($) => {
        $(a);
        return 1;
      });
      const r = new Reaction(() => {});
      expect(() => r.track(($) => $(a))).toThrow(ReferenceError);
      expect(countSources(a)).toBe(1);
      expect(countSources(b)).toBe(0);
      expect(countObservers(b)).toBe(1);
      expect(countObservers(a)).toBe(1);
      expect(countSources(r)).toBe(1);
      expect(() => r.track(($) => $(b))).toThrow(ReferenceError);
      expect(countSources(a)).toBe(0);
      expect(countObservers(a)).toBe(0);
      expect(countSources(b)).toBe(0);
      expect(countObservers(b)).toBe(1); // 1? -> it's r
      expect(countSources(r)).toBe(1);
      expect(() => r.track(($) => $(b))).toThrow(ReferenceError);
      expect(countSources(a)).toBe(0);
      expect(countSources(b)).toBe(0);
      expect(countSources(r)).toBe(1);
      r.dispose();
    });

    it('circular value reference should throw', () => {
      const a = computed(($) => {
        b.current;
        return 1;
      });
      const b = computed(($) => {
        a.current;
        return 1;
      });
      expect(() => a.current).toThrow(ReferenceError);
      expect(() => b.current).toThrow(ReferenceError);
    });
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
      const b = computed(($) => {
        if ($(a)) {
          throw $(a);
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
      const b = computed(($) => $(a));

      let g = 0;
      effect(($) => (g = $(b)));

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

  describe('transaction', () => {
    it('atomicity: not update early', () => {
      const [a, ma] = mutable(0);
      const b = computed(($) => $(a));

      let g = 0;
      effect(($) => (g = $(b)));

      transaction(() => {
        ma(1);
        expect(b.current).toBe(0);
        expect(a.current).toBe(0);
      });
      expect(b.current).toBe(1);
      expect(a.current).toBe(1);
      expect(g).toBe(1);
    });

    it('atomicity: catch error and rollback', () => {
      const [a, ma] = mutable(0);
      const b = computed(($) => $(a));

      let g = 0;
      effect(($) => (g = $(b)));

      let err = {};

      try {
        transaction(() => {
          ma(1);
          expect(b.current).toBe(0);
          expect(a.current).toBe(0);
          throw err;
        });
      } catch (e) {
        expect(e).toBe(err);
      }
      expect(b.current).toBe(0);
      expect(a.current).toBe(0);
      expect(g).toBe(0);
    });

    it('atomicity: no duplicate write', () => {
      const [a, ma] = mutable(0);
      const b = computed(($) => $(a));

      let g = 0;
      effect(($) => (g = $(b)));

      try {
        transaction(() => {
          ma(1);
          ma(1);
          expect(b.current).toBe(0);
          expect(a.current).toBe(0);
        });
      } catch (e) {
        expect(e.message).toBe('Second mutation in a transaction is not allowed');
      }
      expect(b.current).toBe(0);
      expect(a.current).toBe(0);
      expect(g).toBe(0);
    });

    it('flush current batch', () => {
      const [a, ma] = mutable(0);
      const b = computed(($) => $(a));

      let g = 0;
      effect(($) => (g = $(b)));

      batch(() => {
        ma(2);
        transaction(() => {
          transaction(() => {
            ma(1);
            expect(b.current).toBe(2);
            expect(a.current).toBe(2);
          });
        });
        expect(g).toBe(0);
      });
      expect(b.current).toBe(1);
      expect(a.current).toBe(1);
      expect(g).toBe(1);
    });
  });

  describe('IncrementalReaction', () => {
    it('should work as expect', () => {
      const [a, ma] = mutable(0);
      const [b, mb] = mutable(0);
      const fn = jest.fn();
      const reaction = new IncrementalReaction(fn);
      reaction.track(($) => $(a));
      ma(1);
      mb(1);
      expect(fn).toBeCalledTimes(1);
      reaction.continue(($) => ($(a), $(b)));
      ma(2);
      mb(2);
      expect(fn).toBeCalledTimes(3);
      reaction.dispose();
      ma(1);
      mb(1);
      expect(fn).toBeCalledTimes(3);
    });
  });

  afterEach(cleanup);
});
