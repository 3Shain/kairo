import {
  Computation,
  computed,
  Flag,
  lazy,
  mutable,
  runInTransaction,
} from './cell';

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

  it('should establish a reactive relation', () => {
    const [a, setA] = mutable(0);
    const b = computed(() => a.value * 2);
    const c = computed(() => b.value * 2);
    expect(c.value).toBe(0);
    setA(1);
    expect(c.value).toBe(4);
    let result = 0;
    const stopWatch = c.watch((value) => {
      result = value;
    });
    runInTransaction(() => {
      // setA(2);
      // setA(2);
      setA(3);
    });
    expect(result).toBe(12);
    stopWatch();
  });

  it('should establish a reactive relation (static)', () => {
    const [a, setA] = mutable(0);
    const b = computed(() => a.value * 2, { static: true });
    const c = computed(() => b.value * 2, { static: true });
    expect(c.value).toBe(0);
    setA(1);
    expect(c.value).toBe(4);
    let result = 0;
    const stopWatch = c.watch((value) => {
      result = value;
    });
    runInTransaction(() => {
      // setA(2);
      // setA(2);
      setA(3);
    });
    expect(result).toBe(12);
    stopWatch();

    expect(numOfObserverNodes(a)).toBe(1);
    setA(0);
    expect(numOfObserverNodes(a)).toBe(0);
  });

  // it('should establish a reactive relation', () => {});

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
    expect(hasFlag(c, Flag.DepsUnstable)).toBeTruthy();
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

});
