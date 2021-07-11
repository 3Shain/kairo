import { EventStream } from '../stream';
import { Action, Cleanable } from '../types';

export type TaskYieldable<T> =
  | PromiseLike<T>
  | ((resolve: Action<T>, reject: Action<any>) => Cleanable)
  | EventStream<T>;

export type Runnable<T> = {
  /**
   * It could be eager or lazy.
   */
  [Symbol.iterator](): RunnableGenerator<T>;
};

export type RunnableGenerator<T> = Generator<TaskYieldable<any>, T, any>;

export interface ReadableChannel<T> {
  next(): Runnable<T>;
  hasNext(): Runnable<boolean>;
}

/// Not yet ready, too advanced.
export interface WriteableChannel<T> {}
