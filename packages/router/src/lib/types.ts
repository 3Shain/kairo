import type { Cell, EventStream } from 'kairo';

export type Matcher = (pathname: string) => null | MatchResult;

export type MatchResult = {
  /**
   * base pathname. must start with `/`
   */
  basepath: string;
  /**
   * remained pathname. must start with `/`
   */
  pathname: string;
  /**
   * resolved parameters
   */
  params: Record<string,string>;
};

export type Matched = { route: Route; result: MatchResult };

export type Route<T = any> = {
  path?: string;
  match?: Matcher;
} & {
  redirectTo?: string;
  component?: T;
  load?: any;
} & {
  /**
   * If `true`, it will match only when the pathname is exactly the same.
   */
  exact?: boolean;
  /**
   * If `true`, isolated view instances will be created when parameters change.
   */
  isolated?: boolean;
};

export type Location = {
  /**
   * pathname
   */
  pathname: Cell<string>;
  basepath: Cell<string>;
  query: Cell<Query>;
  hash: Cell<string>;
  params: Cell<Record<string, string>>;
  /**
   * @deprecated UNSTABLE
   */
  change: EventStream<LocationChangePayload>;
};

export type NavigateHandler = (
  path: { path: string; query?: Query },
  options?: {
    replace?: boolean;
    preserveQuery?: boolean;
  }
) => void;

export type Query = Record<string, string>;

export type LocationChangePayload = {
  pathname: string;
  search: string;
  hash: any;
};