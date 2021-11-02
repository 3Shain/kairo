import { suspended } from './suspense';
import { computed, mutable as mut } from './cell';
import { effect, cleanup } from './spec-shared';

describe('cell/suspense', () => {
  const SHARED_FALLBACK = {};

  it('should throw if failed', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(($) => s.read($(a)), {
      fallback: SHARED_FALLBACK,
    });
    effect(($) => {
      try {
        $(c);
      } catch {}
    });
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.current).toThrow(`failed_${a.current}`);
    ma(1);
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.current).toThrow(`failed_${a.current}`);
  });

  it('should be able to cascade', async () => {
    const [a, ma] = mut(0);
    const s = mockFetch();
    const c = suspended(($) => s.read($(a)), undefined);
    const d = suspended(
      ($) => {
        return $.read(c);
      },
      {
        fallback: SHARED_FALLBACK,
      }
    );
    const e = computed(($) => $(c));
    effect(($) => $(d));
    effect(($) => $(e));
    expect(d.current).toBe(SHARED_FALLBACK);
    expect(e.current).toBe(undefined);
    await delay(10);
    expect(d.current).toBe(a.current);
    expect(e.current).toBe(a.current);
    ma(1);
    expect(d.current).toBe(SHARED_FALLBACK);
    expect(e.current).toBe(undefined);
    await delay(10);
    expect(d.current).toBe(a.current);
    expect(e.current).toBe(a.current);
  });

  it('should be able to propagate error', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(($) => {
      return s.read($(a));
    }, undefined);
    const d = suspended(
      ($) => {
        return $.read(c);
      },
      {
        fallback: SHARED_FALLBACK,
      }
    );
    const e = computed(($) => $(c));
    effect(($) => {
      try {
        $(d);
      } catch {}
    });
    effect(($) => {
      try {
        $(e);
      } catch {}
    });
    expect(d.current).toBe(SHARED_FALLBACK);
    expect(e.current).toBe(undefined);
    await delay(10);
    expect(() => d.current).toThrow(`failed_${a.current}`);
    expect(() => e.current).toThrow(`failed_${a.current}`);
    ma(1);
    expect(d.current).toBe(SHARED_FALLBACK);
    expect(e.current).toBe(undefined);
    await delay(10);
    expect(() => d.current).toThrow(`failed_${a.current}`);
    expect(() => e.current).toThrow(`failed_${a.current}`);
  });

  it('should batch if shared', async () => {
    const [a, ma] = mut(0);
    const s = mockSharedFetch();
    const c = suspended(
      ($) => {
        return s.read($(a));
      },
      {
        fallback: SHARED_FALLBACK,
      }
    );
    const d = suspended(($) => s.read($(a)), {
      fallback: SHARED_FALLBACK,
    });
    const e = suspended(($) => s.read($(a)), {
      fallback: SHARED_FALLBACK,
    });
    const f = suspended(
      ($) => {
        return s.read($(a));
      },
      {
        fallback: SHARED_FALLBACK,
      }
    );
    const fn = jest.fn();
    effect(($) => ($(c), $(d), $(e), $(f), fn()));
    expect(fn).toBeCalledTimes(1);
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.current).toBe(a.current);
    expect(fn).toBeCalledTimes(2);
    ma(1);
    expect(fn).toBeCalledTimes(3);
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.current).toBe(a.current);
    expect(fn).toBeCalledTimes(4);
  });

  it('should ignore stale promise', async () => {
    const [a, ma] = mut(0);
    const s = mockFetch();
    const c = suspended(
      ($) => {
        return s.read($(a));
      },
      {
        fallback: SHARED_FALLBACK,
      }
    );
    effect(($) => {
      try {
        $(c);
      } catch {}
    });
    expect(c.current).toBe(SHARED_FALLBACK);
    ma(1);
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(c.current).toBe(a.current);
  });

  it('should ignore stale error promise', async () => {
    const [a, ma] = mut(0);
    const s = mockFailedFetch();
    const c = suspended(($) => s.read($(a)), {
      fallback: SHARED_FALLBACK,
    });
    effect(($) => {
      try {
        $(c);
      } catch {}
    });
    expect(c.current).toBe(SHARED_FALLBACK);
    ma(1);
    expect(c.current).toBe(SHARED_FALLBACK);
    await delay(10);
    expect(() => c.current).toThrow(`failed_${a.current}`);
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
