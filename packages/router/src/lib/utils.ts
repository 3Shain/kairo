export function memo() {
  let last: any[] = [];
  let cached: any = null;

  return function get<T>(factory: () => T, deps: any[]) {
    out: while (true) {
      if (deps.length === last.length) {
        for (let i = 0; i < deps.length; i++) {
          if (!Object.is(deps[i], last[i])) {
            break out;
          }
        }
        return cached;
      }
      break;
    }
    cached = factory();
    last = deps;
    return cached as T;
  };
}
