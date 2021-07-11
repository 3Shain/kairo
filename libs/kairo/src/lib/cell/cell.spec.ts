import { combined, computed, lazy, mutable, mutValue, suspended } from './cell';
import {
  Computation,
  Flag,
  transaction as runInTransaction,
  SuspendWithFallback,
  transaction,
} from './internal';
import { start, delay } from '../task';

describe('cell', () => {
  const noop = () => {};

  function hasFlag(c: any, f: Flag) {
    return c['internal'].flags & f;
  }

  function numOfObserverNodes(c: any) {
    let last = c['internal'].last_observer;
    let count = 0;
    while (last !== null) {
      count++;
      last = last.prev_observer;
    }
    return count;
  }

  function numOfSourceNodes(c: any) {
    let last = (c['internal'] as Computation).last_source;
    let count = 0;
    while (last !== null) {
      count++;
      last = last.prev_source;
    }
    return count;
  }

  function numOfWatchers(c: any) {
    let last = (c['internal'] as Computation).last_effect;
    let count = 0;
    while (last !== null) {
      count++;
      last = last.prev;
    }
    return count;
  }

  it('should establish a reactive relation', () => {
    const [a, setA] = mutable(0);
    const [a2, setA2] = mutValue(0);
    const b = a.map((x) => x * 2);
    const c = computed(() => b.value * 2 + a2.value);
    expect(c.value).toBe(0);
    setA(1);
    expect(c.value).toBe(4);
    setA2(1);
    expect(c.value).toBe(5);
    let result = 0;
    const stopWatch = c.watch((value) => {
      result = value;
    });
    runInTransaction(() => {
      setA(3);
      setA2(4);
      expect(c.value).toBe(16); // eager
    });
    expect(result).toBe(16);
    stopWatch();
  });

  it('unused computation should be cleaned up', () => {
    const [a, setA] = mutable(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => {
      if (a.value >= 0) {
        return b.value;
      }
      return 1;
    });
    const stopWatch = c.watch(noop);

    setA(-1);

    expect(hasFlag(b, Flag.Stale)).toBeTruthy();
    expect(numOfSourceNodes(b)).toBe(0);
    expect(numOfObserverNodes(b)).toBe(0);
    expect(numOfObserverNodes(a)).toBe(1);
    expect(numOfSourceNodes(c)).toBe(1);

    setA(1);

    expect(hasFlag(b, Flag.Stale)).toBeFalsy();
    expect(numOfSourceNodes(b)).toBe(1);
    expect(numOfObserverNodes(b)).toBe(1);
    expect(numOfObserverNodes(a)).toBe(2);
    expect(numOfSourceNodes(c)).toBe(2);

    stopWatch();
  });

  it('unused computation should be cleaned up (2)', () => {
    const [a, setA] = mutable(0);
    const b1 = computed(() => a.value * 2);
    const b2 = computed(() => a.value * 4);
    const c = computed(() => {
      if (a.value >= 0) {
        return b1.value;
      }
      return b2.value;
    });
    const stopWatch = c.watch(noop);

    setA(-1);

    expect(hasFlag(b1, Flag.Stale)).toBeTruthy();
    // expect(hasFlag(c, Flag.DepsUnstable)).toBeTruthy();
    expect(numOfSourceNodes(b1)).toBe(0);
    expect(numOfObserverNodes(b1)).toBe(0);
    expect(numOfObserverNodes(a)).toBe(2);
    expect(numOfSourceNodes(c)).toBe(2);

    setA(1);

    expect(hasFlag(b1, Flag.Stale)).toBeFalsy();
    expect(numOfSourceNodes(b1)).toBe(1);
    expect(numOfObserverNodes(b1)).toBe(1);
    expect(numOfObserverNodes(a)).toBe(2);
    expect(numOfSourceNodes(c)).toBe(2);

    stopWatch();
  });

  it('lazy', () => {
    const l = lazy<number>();

    const [a, setA] = mutable(0);
    const b = computed(() => a.value * 2);

    let updated = false;
    l.watch(() => {
      updated = true;
    });

    expect(
      l.execute(() => {
        return a.value + b.value;
      })
    ).toBe(0);
    expect(numOfSourceNodes(l as any)).toBe(2);

    setA(1);

    expect(updated).toBeTruthy();
    expect(hasFlag(l, Flag.Stale)).toBeTruthy();
    expect(
      l.execute(() => {
        return a.value + b.value;
      })
    ).toBe(3);
    expect(hasFlag(l, Flag.Stale)).toBeFalsy();
  });

  it('suspended', () => {
    const fn = jest.fn();
    const [para, setPara] = mutValue(0);
    const sus = suspended(() => {
      if (para.value) {
        throw new SuspendWithFallback(1, fn);
      }
      return 2;
    }, undefined);
    const stop = sus.watch(noop);
    setPara(1);
    expect(sus.value).toBe(1);
    setPara(0);
    expect(sus.value).toBe(2);
    expect(fn).toBeCalledTimes(1);
    stop();
  });

  it('combined (array)', () => {
    const [a, setA] = mutValue(1);
    const [b, setB] = mutValue(2);
    const c = combined([a, b], ([_a, _b]) => _a + _b);
    expect(c.value).toBe(3);
    const stop = c.watch(noop);
    transaction(() => {
      setA(3);
      setB(4);
    });
    expect(c.value).toBe(7);
    expect(hasFlag(c, Flag.Stale)).toBeFalsy();
    expect(numOfSourceNodes(c)).toBe(2);
    stop();
  });

  it('combined (object)', () => {
    const [a, setA] = mutValue(1);
    const [b, setB] = mutValue(2);
    const c = combined({ a, b }, ({ a: _a, b: _b }) => _a + _b);
    expect(c.value).toBe(3);
    const stop = c.watch(noop);
    transaction(() => {
      setA(3);
      setB(4);
    });
    expect(c.value).toBe(7);
    expect(hasFlag(c, Flag.Stale)).toBeFalsy();
    expect(numOfSourceNodes(c)).toBe(2);
    stop();
  });

  it('yield*', async () => {
    const [a, setA] = mutValue(1);
    const b = a.map(x=>x*2);

    start(
      (function* () {
        yield* delay(1);
        while (true) {
          setA(a.value + 1);
          if (a.value > 10) {
            break;
          }
          yield* delay(1);
        }
      })()
    );
    await start(
      (function* () {
        while (b.value != 10) {
          yield* b;
          expect(hasFlag(b,Flag.Stale)).toBeFalsy();
          expect(numOfSourceNodes(b)).toBe(1);
          expect(numOfWatchers(b)).toBe(0);
        }
      })()
    );
  });
});
