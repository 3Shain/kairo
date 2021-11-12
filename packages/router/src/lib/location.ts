import {
  computed,
  Identifier,
  injected,
  lifecycle,
  mut,
  batch,
  Cell,
  Concern,
} from 'kairo';
import { Location, LocationChangePayload, MatchResult } from './types';
import type { History } from 'history';
import { parseQuery, resolvePath } from './core';

export const LOCATION = Identifier.of<Location>('KairoRouterLocation');
export const HISTORY = Identifier.of<History>('KairoRouterHistroy');

function rootLocation(history: History): Location {
  lifecycle(() =>
    history.listen(({ location }) => {
      batch(() => {
        setLocationState({
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        });
      });
    })
  );

  const { location } = history;
  const [locationState, setLocationState] =
    mut<LocationChangePayload>(location);

  return {
    pathname: locationState.map((x) => x.pathname),
    basepath: Cell.of('/'),
    search: locationState.map((x) => parseQuery(x.search.substring(1))),
    hash: locationState.map((x) => x.hash),
    params: Cell.of({}),
  };
}

export function derivedLocation(result: Cell<MatchResult>): Location {
  const { search, hash, basepath }: Location = injected(LOCATION);

  const currentBasepath = computed(($) =>
    resolvePath('.' + $(result).basepath, $(basepath))
  );
  return {
    pathname: result.map((x) => x.pathname),
    basepath: currentBasepath,
    search,
    hash,
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
