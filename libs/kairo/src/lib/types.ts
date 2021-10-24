export type Action<T> = (payload: T) => void;

export interface Disposable {
  dispose(): void;
}

export type TeardownLogic = () => void;

export type Cleanable =
  | TeardownLogic
  | {
      cancel(): void;
    }
  | {
      dispose(): void;
    }
  | {
      unsubscribe(): void;
    }
  | {
      abort(): void;
    }
  | void;

declare global {
  interface SymbolConstructor {
    readonly observable: unique symbol;
  }
}

export const Symbol_observable = (
  /* istanbul ignore next: simple expression*/ () =>
  (typeof Symbol === 'function' && Symbol.observable) || '@@observable')();

/**
 * Observable type definations
 */
export declare type InteropObservable<T> = {
  [Symbol.observable]: () => Subscribable<T>;
};

export interface Subscribable<T> {
  subscribe(observer?: PartialObserver<T>): Subscription;
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
}
export interface Unsubscribable {
  unsubscribe(): void;
}
export interface Subscription extends Unsubscribable {
  get closed(): boolean;
}

interface NextObserver<T> {
  start?: (subscription: Subscription) => void;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}
interface ErrorObserver<T> {
  start?: (subscription: Subscription) => void;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}
interface CompletionObserver<T> {
  start?: (subscription: Subscription) => void;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}
export type PartialObserver<T> =
  | NextObserver<T>
  | ErrorObserver<T>
  | CompletionObserver<T>;
