import {
  computed,
  Identifier,
  injected,
  lifecycle,
  mut,
  stream,
  batch,
  EventStream,
  Cell,
  Concern,
} from 'kairo';
import { Location, LocationChangePayload, MatchResult } from './types';
import type { History } from 'history';
import { parseQuery, resolvePath } from './core';

export const LOCATION = Identifier.of<Location>('KairoRouterLocation');
export const HISTORY = Identifier.of<History>('KairoRouterHistroy');

function reduced<T, R>(
  eventStream: EventStream<T>,
  reducer: (current: R, event: T) => R,
  init: R
) {
  const [state, setState] = mut(init);

  lifecycle(() =>
    eventStream.listen((x) => {
      setState((v) => reducer(v, x));
    })
  );

  return state;
}

function rootLocation(history: History): Location {
  const [change, onchange] = stream<LocationChangePayload>();

  lifecycle(() =>
    history.listen(({ location }) => {
      batch(() => {
        onchange({
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        });
      });
    })
  );

  const {
    location: { pathname, search, hash },
  } = history;
  const locationState = reduced(change, (_, x) => x, {
    pathname,
    search,
    hash,
  });

  return {
    pathname: locationState.map((x) => x.pathname),
    basepath: Cell.of('/'),
    search: locationState.map((x) => parseQuery(x.search.substring(1))),
    hash: locationState.map((x) => x.hash),
    change,
    params: Cell.of({}),
  };
}

export function derivedLocation(result: Cell<MatchResult>): Location {
  const { search, hash, change, basepath }: Location = injected(LOCATION);

  const currentBasepath = computed(($) =>
    resolvePath('.' + $(result).basepath, $(basepath))
  );
  return {
    pathname: result.map((x) => x.pathname),
    basepath: currentBasepath,
    search,
    hash,
    change,
    params: result.map((x) => x.params),
  };
}

export function configureLocation(history: History): Concern {
  return () => {
    return {
      [LOCATION]: rootLocation(history),
      [HISTORY]: history,
    };
  };
}
