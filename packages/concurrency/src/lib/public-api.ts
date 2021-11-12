/* istanbul ignore file */

import { EventStream } from './stream';

export function isEventStream<T>(value: unknown): value is EventStream<T> {
  return value instanceof EventStream;
}

export {
  task,
  delay,
  timeout,
  nextAnimationFrame,
  resolve,
  TaskSuspended,
  AbortablePromise,
  AbortedError,
  TaskKilledError,
} from './task';
export type { Task } from './task';
export { all, any, race, allSettled } from './combinators';
export { ControlStatements } from './control-statements';
export * from './types';
export { EventStream, stream, merged } from './stream';
