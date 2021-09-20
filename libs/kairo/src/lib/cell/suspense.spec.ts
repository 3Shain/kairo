import { suspended } from './suspense';
import { computed, mutable as mut } from './cell';
import { effect, cleanup } from './cell.spec';

describe('cell/suspense', () => {
  const SHARED_FALLBACK = {};

  it('should throw if failed', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    effect(() => c.error);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.value).toThrow(`failed_${a.value}`);
    ma(1);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.value).toThrow(`failed_${a.value}`);
  });

  it('should cascade', async () => {
    const [a, ma] = mut(0);
    const s = mockFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, undefined);
    const d = suspended(() => {
      return c.read();
    }, SHARED_FALLBACK);
    const e = computed(() => c.value);
    effect(() => d.value);
    effect(() => e.value);
    expect(d.value).toBe(SHARED_FALLBACK);
    expect(e.value).toBe(undefined);
    await delay(10);
    expect(d.value).toBe(a.value);
    expect(e.value).toBe(a.value);
    ma(1);
    expect(d.value).toBe(SHARED_FALLBACK);
    expect(e.value).toBe(undefined);
    await delay(10);
    expect(d.value).toBe(a.value);
    expect(e.value).toBe(a.value);
  });

  it('should cascade error', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, undefined);
    const d = suspended(() => {
      return c.read();
    }, SHARED_FALLBACK);
    const e = computed(() => c.value);
    effect(() => d.error);
    effect(() => e.error);
    expect(d.value).toBe(SHARED_FALLBACK);
    expect(e.value).toBe(undefined);
    await delay(10);
    expect(() => d.value).toThrow(`failed_${a.value}`);
    expect(() => e.value).toThrow(`failed_${a.value}`);
    ma(1);
    expect(d.value).toBe(SHARED_FALLBACK);
    expect(e.value).toBe(undefined);
    await delay(10);
    expect(() => d.value).toThrow(`failed_${a.value}`);
    expect(() => e.value).toThrow(`failed_${a.value}`);
  });

  it('should batch if shared', async () => {
    const [a, ma] = mut(0);
    const s = mockSharedFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    const d = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    const e = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    const f = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    const fn = jest.fn();
    effect(() => (c.value, d.value, e.value, f.value, fn()));
    expect(fn).toBeCalledTimes(1);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.value).toBe(a.value);
    expect(fn).toBeCalledTimes(2);
    ma(1);
    expect(fn).toBeCalledTimes(3);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.value).toBe(a.value);
    expect(fn).toBeCalledTimes(4);
  });

  it('should ignore stale promise', async () => {
    const [a, ma] = mut(0);
    const s = mockFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    effect(() => c.error);
    expect(c.value).toBe(SHARED_FALLBACK);
    ma(1);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.value).toBe(a.value);
  });

  it('should ignore stale error promise', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(() => {
      return s.read(a.value);
    }, SHARED_FALLBACK);
    effect(() => c.error);
    expect(c.value).toBe(SHARED_FALLBACK);
    ma(1);
    expect(c.value).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.value).toThrow(`failed_${a.value}`);
  });

  afterEach(() => {
    cleanup();
  });
});

function mockFetch() {
  let cache = {};
  return {
    read(parameter: number) {
      if (cache[parameter] === undefined) {
        throw new Promise((res) => {
          setTimeout(() => {
            cache[parameter] = parameter;
            res(undefined);
          }, 0);
        });
      }
      return cache[parameter];
    },
  };
}

function mockFailedFetch() {
  let cache = {};
  return {
    read(parameter: number) {
      if (cache[parameter] === undefined) {
        throw new Promise((_, rej) => {
          setTimeout(() => {
            cache[parameter] = parameter;
            rej(new Error(`failed_${parameter}`));
          }, 0);
        });
      }
      return cache[parameter];
    },
  };
}

function mockSharedFetch() {
  let cache = {},
    fetching = {};
  return {
    read(parameter: number) {
      if (cache[parameter] === undefined) {
        if (fetching[parameter] !== undefined) {
          throw fetching[parameter];
        }
        fetching[parameter] = new Promise((res) => {
          setTimeout(() => {
            cache[parameter] = parameter;
            fetching[parameter] = undefined;
            res(undefined);
          }, 0);
        });
        throw fetching[parameter];
      }
      return cache[parameter];
    },
  };
}

function delay(time: number) {
  return new Promise((res) => {
    setTimeout(res, time);
  });
}
