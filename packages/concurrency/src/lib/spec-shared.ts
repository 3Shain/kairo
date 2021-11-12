/* istanbul ignore file: for test only */

import { TaskSuspended } from './task';
import { Runnable } from './types';

export function* neverFulfill(fn: Function): Runnable<void> {
  yield () => {
    throw new TaskSuspended(() => fn());
  };
}

export function* throwWhenAborted(error: any): Runnable<void> {
  yield () => {
    throw new TaskSuspended(() => {
      throw error;
    });
  };
}
