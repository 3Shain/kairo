const symbol_boxing = Symbol('boxing');

function boxing(value: unknown) {
  if (typeof value === 'object') {
    if (value !== null) {
      return value;
    }
  } else if (typeof value === 'function') {
    return value;
  }
  return {
    [symbol_boxing]: value,
  };
}

function unboxing(object: object) {
  if (symbol_boxing in object) {
    // @ts-ignore
    return object[symbol_boxing];
  }
  return object;
}

const symbol_ref = Symbol('reference');

function weakCache<T extends (input: any) => any>(f: T): T {
  const cache = new Map<any, WeakRef<any>>();
  const registry = new FinalizationRegistry((input) => {
    const ref = cache.get(input);
    if (ref && !ref.deref()) cache.delete(input); // incase input is re-added
  });

  const ret = function memoized(input: any) {
    const ref = cache.get(input);
    if (ref) {
      const ret = ref.deref();
      // it's possible that the value has been collected but the cleanup callback hasn't run yet.
      if (ret !== undefined) return unboxing(ret);
    }
    const value = boxing(f(input));
    cache.set(input, new WeakRef(value));
    registry.register(value, input);
    Object.defineProperty(value, symbol_ref, {
      writable: false,
      enumerable: false,
      configurable: false,
      value: memoized,
    });
    return unboxing(value);
  } as T;
  if (__TEST__) {
    // @ts-ignore
    ret['cache'] = cache;
  }
  return ret;
}

function weakCurry<Fn extends (...args: any[]) => any>(
  fn: Fn,
  size: number
): any {
  return weakCache((a: any) => {
    if (size > 1) {
      return weakCurry((...args: any) => fn(a, ...args), size - 1);
    }
    return fn(a);
  });
}

function memoize<Fn extends (...args: any[]) => any>(fn: Fn): Fn {
  const cache = weakCurry(fn, fn.length);

  const ret = function memoized(...remains: any[]) {
    let ret = cache;
    for (let i = 0; i < fn.length; i++) {
      ret = ret(remains[i]);
    }
    return ret;
  };
  if (__TEST__) {
    // @ts-ignore
    ret['cache'] = cache;
  }
  if (__DEV__) {
    Object.defineProperty(ret, 'name', { value: `memoize(${fn.name})` });
  }
  // @ts-ignore
  return ret;
}

export { memoize };
