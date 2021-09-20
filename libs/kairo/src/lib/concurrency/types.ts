import { Action, Cleanable } from '../types';

export type TaskYieldable<T> = (
  resolve: Action<T>,
  reject: Action<any>
) => Cleanable;

export type Runnable<T> = {
  [Symbol.iterator](): RunnableGenerator<T>;
};

export type AsyncRunnable<T> = {
  [Symbol.asyncIterator](): AsyncRunnableGenerator<T>;
};

export type RunnableGenerator<T> = Generator<TaskYieldable<any>, T, any>;
export type AsyncRunnableGenerator<T> = AsyncGenerator<
  TaskYieldable<any>,
  T,
  any
>;

export interface ReadableChannel<T> {
  next(): Runnable<T>;
  hasNext(): Runnable<boolean>;
}
