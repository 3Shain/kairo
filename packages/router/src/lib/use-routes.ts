import {
  Cell,
  computed,
  Concern,
  effect,
  injected,
  suspended,
  CellSuspended,
} from 'kairo';
import { compareMatch, findMatch, resolvePath, stringfyQuery } from './core';
import { derivedLocation, HistoryId, LocationId } from './location';
import { Route, MatchResult, NavigateHandler, Location } from './types';
import { memo } from './utils';

let componentCache: WeakMap<any, any> = new WeakMap();

function readComponent(x: () => Promise<any>) {
  if (componentCache.has(x)) {
    return componentCache.get(x);
  }
  throw new CellSuspended(async () => {
    componentCache.set(x, await x());
  });
}

const FOREVER_PENDING_PROMISE = new Promise(() => {});

export function useRoutes(
  routes: Cell<Route[]>,
  bind: (concern: Concern, x: any) => any
) {
  const location = injected(LocationId);
  const navigate = useNavigate();

  const _matched = computed(($) => findMatch($(routes), $(location.pathname)));

  const matchedRouteAndParams = computed(($) => $(_matched), undefined, {
    comparator: compareMatch,
  });

  effect(($) => {
    const filtered = $(matchedRouteAndParams);
    if (filtered.route.redirectTo) {
      console.log(filtered.route.redirectTo);
      navigate({
        path: filtered.route.redirectTo,
      }, {
        replace: true
      });
    }
  });

  const _memo = memo();

  const component = suspended<any, null>(
    ($) => {
      const matched = $(matchedRouteAndParams),
        { route, result } = matched;
      if (route.redirectTo) {
        throw new CellSuspended(() => FOREVER_PENDING_PROMISE); // forever pending promise: will be freed soon.
      }
      const component = route.load
        ? readComponent(route.load)
        : route.component;
      return _memo(
        () =>
          (bind(() => {
            const _result: Cell<MatchResult> = computed((get) => {
              const __matched = get(_matched);
              return compareMatch(matched, __matched)
                ? __matched.result
                : get(_result);
            }, result);
            return {
              [LocationId]: derivedLocation(_result),
            };
          }, component)),
        [
          route.load,
          route.component,
          result.basepath,
          result.pathname,
          route.exact ? JSON.stringify(result.params) : undefined,
        ]
      ); // boundContext
    },
    { fallback: null }
  );

  return component;
}

export function useParam<T>(
  name: string,
  options: { parse: (value: string) => T }
): Cell<T>;
export function useParam(name: string): Cell<string>;
export function useParam(
  name: string,
  options?: { parse: (value: string) => any }
): Cell<any> {
  const location = injected(LocationId);

  return computed(($) => {
    const result = $(location.params)[name];
    if (options?.parse) {
      return options.parse(result);
    }
    return result;
  });
}

export function useQuery<T>(
  name: string,
  options: { parse: (value: string) => T; stringfy: (value: T) => string }
): [Cell<T>, (value: T) => void];
export function useQuery(name: string): [Cell<string>, (value: string) => void];
export function useQuery(
  name: string,
  options?: { parse: (value: string) => any; stringfy: (value: any) => string }
): [Cell<any>, (value: any) => void] {
  const location = injected(LocationId);
  const navigate = useNavigate();

  return [
    computed(($) => {
      const result = $(location.query)[name];
      if (options?.parse) {
        return options.parse(result);
      }
      return result;
    }),
    (value) => {
      navigate(
        {
          path: '.',
          query: {
            [name]: options?.stringfy ? options.stringfy(value) : value,
          },
        },
        {
          replace: true,
          preserveQuery: true,
        }
      );
    },
  ];
}

export function useLocation(): Location {
  return injected(LocationId);
}

export function useNavigate(): NavigateHandler {
  const location = injected(LocationId);
  const history = injected(HistoryId);

  return function navigate(to, options) {
    const _query = options?.preserveQuery
      ? {
          ...location.query.current,
          ...to.query,
        }
      : to.query;
    const search = _query
      ? Object.keys(_query).length > 0
        ? `?${stringfyQuery(_query ?? {})}`
        : undefined
      : undefined;
    const pathname = resolvePath(to.path, location.basepath.current);
    if (options?.replace) {
      history.replace({
        pathname,
        search,
      });
    } else {
      history.push({
        pathname,
        search,
      });
    }
  };
}

export function useMatch() {}
