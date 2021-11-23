import { memoize } from './memoize';

function fn(a) {
  return { a };
}

function id(a) {
  return a;
}

function fn2(a, b) {
  return { a, b };
}

if(typeof global.gc === 'undefined'){
  global.gc = ()=>{};
}

describe('memoize', () => {
  it('should work 1', async () => {
    let memoized = memoize(fn);

    let a = memoized(11);
    const weakref = new WeakRef(a);

    expect(a).toBe(memoized(11));

    a = null; // de-ref

    await waitMacrotask();

    global.gc();

    expect(weakref.deref()).toBe(undefined);

    await waitMacrotask();

    expect(memoized['cache']['cache'].size).toBe(0);
  });

  it('should work primitive', async () => {
    let memoized = memoize(id);

    let a = memoized(11);

    expect(a).toBe(memoized(11));

    await waitMacrotask();

    global.gc();

    await waitMacrotask();

    expect(memoized['cache']['cache'].size).toBe(0);
  });

  it('should work 2', async () => {
    let memoized = memoize(fn2);

    let a = memoized(11, 22);
    const weakref = new WeakRef(a);

    expect(a).toBe(memoized(11, 22));

    let bbb = memoized(11, 12);

    a = null; // de-ref

    await new Promise((x) => setTimeout(x));

    global.gc();

    expect(weakref.deref()).toBe(undefined);

    global.gc();

    expect(memoized(11, 12)).toBe(bbb);

    bbb = null;
    global.gc();

    await waitMacrotask();

    global.gc();

    await waitMacrotask();

    expect(memoized['cache']['cache'].size).toBe(0);
  });
});

function waitMacrotask() {
  return new Promise((x) => setTimeout(x));
}
