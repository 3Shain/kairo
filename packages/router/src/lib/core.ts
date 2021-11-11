import type { Route, Matcher, Matched, MatchResult, Search } from './types';

function getSegments(path: string) {
  return path
    .split('/')
    .slice(path.startsWith('/') ? 1 : 0, path.endsWith('/') ? -1 : undefined);
}

export function createPathMatcher(object: {
  path: string;
  exact: boolean;
}): Matcher {
  return function matcher(pathname: string) {
    if (object.path === '*')
      return {
        pathname,
        basepath: '/',
        params: {},
      };
    const segments = getSegments(pathname);
    const toMatchSegments = getSegments(object.path);
    let i = 0,
      params = {};
    for (; i < toMatchSegments.length; i++) {
      if (segments.length <= i) {
        return null;
      }
      if (toMatchSegments[i].startsWith(':')) {
        params[toMatchSegments[i].slice(1)] = segments[i];
        continue;
      }
      if (segments[i] !== toMatchSegments[i]) {
        return null;
      }
    }
    if (object.exact && segments.length != i) return null;
    return {
      params,
      pathname: segments.length > i ? `/${segments.slice(i).join('/')}` : '/',
      basepath: i > 0 ? `/${segments.slice(0, i).join('/')}` : '/',
    };
  };
}

export function matchRoute(route: Route, pathname: string) {
  const result = (route.match ? route.match : createPathMatcher(route as any))(
    pathname
  );
  /* istanbul ignore if: defensive */ if(result){
    if(!result.basepath.startsWith('/')) {
      throw new Error(`"${result.basepath}" is not a valid basepath: it should start with '/'`);
    }
    if(!result.pathname.startsWith('/')) {
      throw new Error(`"${result.pathname}" is not a valid pathname: it should start with '/'`);
    }
  }
  return result;
}

export function findMatch(routes: Route[], pathname: string): Matched {
  for (const route of routes) {
    const result = matchRoute(route, pathname);
    if (result != null)
      return {
        route,
        result,
      };
  }
  throw new Error('No match record');
}

export function compareMatch(a: Matched, b: Matched) {
  /* istanbul ignore if: simple */ if (a === b) return true;
  return (
    // do not check on match dependencies
    a.route.component === b.route.component &&
    a.route.load === b.route.load && // be careful: may get different reference...
    a.route.redirectTo === b.route.redirectTo &&
    a.result.pathname === b.result.pathname &&
    a.route.isolated === b.route.isolated &&
    (a.route.isolated
      ? shallowStringRecordEqual(a.result.params, b.result.params)
      : true)
  );
}

export function shallowStringRecordEqual(a: any, b: any): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 *
 * @param to relative or absolute target path
 * @param from absolute source path
 * @returns abosulte target path
 */
export function resolvePath(to: string, from: string) {
  if (to.startsWith('/')) {
    return to; // it's already absolute
  }
  if (to === '' || to === '.' || to === './') return from;
  const toSegments = getSegments(to),
    fromSegments = getSegments(from);
  let offset = 0,
    strip = 0,
    c = false;
  for (const seg of toSegments) {
    if (seg === '.') {
      if (c) throw new Error('Bad path');
      if (offset !== 0) throw new Error('Bad path');
      strip++;
      c = true;
      continue;
    } else if (seg === '..') {
      if (c) throw new Error('Bad path');
      offset++;
    } else {
      c = true;
    }
  }
  if (fromSegments.length < offset) {
    throw new Error('Bad path');
  }
  return (
    '/' +
    [
      ...fromSegments.slice(0, fromSegments.length - offset),
      ...toSegments.slice(offset + strip),
    ].join('/')
  );
}

export function parseQuery(query: string): Search {
  return Object.fromEntries(
    query.split('&').map((x) => x.split('=') as [string, string])
  );
}

export function stringfyQuery(query: Search) {
  return Object.entries(query)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}
