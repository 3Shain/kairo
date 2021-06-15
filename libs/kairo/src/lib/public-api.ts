import { runInTransaction, Cell } from './cell';
import { EventStream } from './stream';

export function isCell<T>(value: unknown): value is Cell<T> {
  return value instanceof Cell;
}

export function isEventStream<T>(value: unknown): value is EventStream<T> {
  return value instanceof EventStream;
}

export function action<Fn extends (...args: any[]) => any>(
  fn: Fn
): (...args: Parameters<Fn>) => ReturnType<Fn> {
  const ret = (...args: any[]) => runInTransaction(() => fn(...args));
  // ret.name = fn.name;
  return ret;
}

export {
  Cell,
  ComputationalCell,
  Cell as Behavior,
  mutable,
  mutable as mut,
  constant,
  combined,
  computed,
  suspended,
  lazy,
  runInTransaction as transaction,
  untrack,
  __current_collecting,
} from './cell';
export type { UnwrapProperty } from './cell';
export { EventStream, stream, never, merged } from './stream';
export { inject, provide, effect, Scope, Token } from './scope';
export type { Provider, Factory } from './scope';
export { held, reduced } from './derived';
export * from './read';
export * from './schedule';
export * from './complex-mutables';
export * from './task';
