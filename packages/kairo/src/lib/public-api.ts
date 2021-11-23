import { Cell } from './cell';

export function isCell<T>(value: unknown): value is Cell<T> {
  return value instanceof Cell;
}

export * from './cell';
export { mutable as mut } from './cell';
export * from './lifecycle-scope';
export * from './context';
export * from './reference';
export { reference as ref } from './reference';
export * from './effect';
export * from './misc';
export * from './memoize';