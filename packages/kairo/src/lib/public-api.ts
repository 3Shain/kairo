import { Cell } from './cell';
import { EventStream } from './stream';

export function isCell<T>(value: unknown): value is Cell<T> {
  return value instanceof Cell;
}

export function isEventStream<T>(value: unknown): value is EventStream<T> {
  return value instanceof EventStream;
}

export * from './cell';
export { mutable as mut } from './cell';
export { EventStream, stream, merged } from './stream';
export * from './lifecycle-scope';
export * from './context';
export * from './schedule';
export * from './concurrency';
export * from './reference';
export { reference as ref } from './reference';
export * from './debug';
export * from './effect';
