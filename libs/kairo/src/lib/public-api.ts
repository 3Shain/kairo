import {
  transaction,
  Cell,
  WatchOptions,
  lazy
} from './cell';
import { mount } from './scope';
import { EventStream } from './stream';
import { Cleanable } from './types';

export function isCell<T>(value: unknown): value is Cell<T> {
  return value instanceof Cell;
}

export function isEventStream<T>(value: unknown): value is EventStream<T> {
  return value instanceof EventStream;
}

export function action<Fn extends (...args: any[]) => any>(
  fn: Fn
): (...args: Parameters<Fn>) => ReturnType<Fn> {
  return (...args: any[]) => transaction(() => fn(...args));
}

export function watch<T>(
  cell: Cell<T>,
  sideEffect: (value: T) => Cleanable,
  options?: WatchOptions
) {
  mount(() => cell.watch(sideEffect, options));
}

export function listen<T>(
  stream: EventStream<T>,
  handler: (payload: T) => Cleanable
) {
  mount(() => stream.listen(handler));
}

export function autorun(sideEffect: () => Cleanable) {
  mount(() => {
    const l = lazy<Cleanable>();
    return l.watch(
      () => {
        return l.execute(sideEffect);
      },
      { immediate: true }
    );
  });
}

export * from './cell';
export { mutable as mut } from './cell';
export { EventStream, stream, never, merged } from './stream';
export { inject, provide, mount, mount as effect, Scope, Token } from './scope';
export type { Provider, Factory } from './scope';
export { held, reduced } from './derived';
export * from './read';
export * from './schedule';
export * from './task';
export * from './reference';
