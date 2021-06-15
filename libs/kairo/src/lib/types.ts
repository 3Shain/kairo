import { Cell } from './cell';

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
  | void;

export type MaybeBehavior<T> = T extends Cell<infer C> ? C : T;

export const Symbol_observable = (() =>
  (typeof Symbol === 'function' && Symbol.observable) || '@@observable')();

/**
 * Observable type definations
 */
export declare type InteropObservable<T> = {
  [Symbol.observable]: () => Subscribable<T>;
};

export interface Subscribable<T> {
  subscribe(observer?: PartialObserver<T>): Unsubscribable;
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Unsubscribable;
}
export interface Unsubscribable {
  unsubscribe(): void;
}
export interface NextObserver<T> {
  closed?: boolean;
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}
export interface ErrorObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error: (err: any) => void;
  complete?: () => void;
}
export interface CompletionObserver<T> {
  closed?: boolean;
  next?: (value: T) => void;
  error?: (err: any) => void;
  complete: () => void;
}
export declare type PartialObserver<T> =
  | NextObserver<T>
  | ErrorObserver<T>
  | CompletionObserver<T>;
