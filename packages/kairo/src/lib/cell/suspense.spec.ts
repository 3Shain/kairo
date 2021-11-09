import { suspended, CellSuspended } from './suspense';
import { computed, mutable as mut, Reaction } from './cell';
import { effect, cleanup } from './spec-shared';

describe('cell/suspense', () => {
  const SHARED_FALLBACK = {};

  it('it is a memo', () => {
    const [a, ma] = mut(0);
    const b = suspended(($) => $(a));
    const e = new Error('custom');
    const c = suspended(($) => {
      $(a);
      throw e;
    });

    expect(b.current).toBe(0);
    expect(() => c.current).toThrow(e);

    effect(($) => $(b));
    effect(($) => expect($.error(c)).toBe(e));
    ma(1);
  });

  it('will suspend', async () => {
    const cache = mockCache();
    const [a, ma] = mut('hello');
    const b = suspended(
      ($) => {
        return cache.get($(a));
      },
      { fallback: SHARED_FALLBACK }
    );

    expect(b.current).toBe(SHARED_FALLBACK);

    const r = new Reaction(() => {});
    r.track((s) => s(b));
    cache.assertItemExist('hello');
    await cache.wait('hello');
    expect(b.current).toBe('hello');
  });

  it('will abort previous', async () => {
    const cache = mockCache();
    const [a, ma] = mut('hello');
    const b = suspended(
      ($) => {
        return cache.get($(a));
      },
      { fallback: SHARED_FALLBACK }
    );

    expect(b.current).toBe(SHARED_FALLBACK);

    const r = new Reaction(() => {});
    r.track((s) => s(b));
    cache.assertItemExist('hello');
    ma('world');
    cache.assertItemExist('world');
    await cache.wait('world');
    expect(b.current).toBe('world');
  });

  it('cascade', async () => {
    const cache = mockCache();
    const [a, ma] = mut('hello');
    const c = suspended(($) => {
      return cache.get($(a));
    });
    const b = suspended(
      ($) => {
        return $.suspend(c) + '_';
      },
      { fallback: SHARED_FALLBACK }
    );

    expect(b.current).toBe(SHARED_FALLBACK);

    const r = new Reaction(() => {});
    r.track((s) => s(b));
    cache.assertItemExist('hello');
    await cache.wait('hello');
    expect(b.current).toBe('hello_');
  });

  afterEach(() => {
    cleanup();
  });
});

function mockCache() {
  const cache = {};
  const suspending = {};

  return {
    get(id: string): string {
      if (cache[id]) {
        return cache[id];
      } else {
        throw new CellSuspended(
          () =>
            (suspending[id] = new Promise((resolve) => {
              cache[id] = id;
              setTimeout(resolve, 1);
            }))
        );
      }
    },

    assertItemExist(id: string) {
      if (cache[id] === undefined) {
        throw new Error('Assertation failed');
      }
    },
    wait(id: string) {
      return suspending[id];
    },
  };
}
