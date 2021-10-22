import type { Subscribable } from '../types';
import {
  resolve,
  TaskSuspended,
  __fulfill,
  executeRunnableTask,
} from './task';
import type { Runnable, TaskResult } from './types';

type Resolve<T> = T extends PromiseLike<infer P>
  ? P
  : T extends Subscribable<infer S>
  ? S
  : T extends Runnable<infer R>
  ? R
  : T;

type ResolveAll<T> = {
  [P in keyof T]: Resolve<T[P]>;
};

export function* any<T>(tasks: Iterable<T>): Runnable<ResolveAll<T>> {
  return yield (next) => {
    let count = 0,
      errorCount = 0;
    const errors: any[] = [];
    const disposers: TaskSuspended[] = [];
    for (const task of tasks) {
      try {
        const closureIndex = count++;
        const result = executeRunnableTask(resolve(task), (result) => {
          if (result.type === 'fulfill') {
            next(result);
            disposers.forEach((x) => x.abort());
          } else if (result.type === 'error') {
            errorCount++;
            errors[closureIndex] = result.error;
            if (count === errorCount) {
              next({
                type: 'error',
                error: new AggregateError(errors, 'All tasks failed.'),
              });
            }
          }
        });
        // convert illegal complete to
        if (result.type === 'fulfill') {
          disposers.forEach((x) => x.abort());
          return result;
        } else {
          if (result.type === 'error') {
            errorCount++;
            errors[closureIndex] = result.error;
          }
        }
      } catch (e) {
        if (e instanceof TaskSuspended) {
          disposers.push(e);
          continue;
        }
        // istanbul ignore next
        throw e; // happend while abort
      }
    }
    if (count === errorCount) {
      return {
        type: 'error',
        error: new AggregateError(errors, 'All tasks failed.'),
      };
    }
    throw new TaskSuspended(() => {
      disposers.forEach((x) => x.abort());
    });
  };
}

export function* race<T>(tasks: Iterable<T>): Runnable<ResolveAll<T>> {
  return yield (next) => {
    let settled = false;
    const disposers: TaskSuspended[] = [];
    for (const task of tasks) {
      try {
        const ret = executeRunnableTask(resolve(task), (result) => {
          if (settled) return;
          settled = true;
          disposers.forEach((x) => x.abort());
          next(result);
        });
        settled = true;
        disposers.forEach((x) => x.abort());
        return ret;
      } catch (e: any) {
        if (e instanceof TaskSuspended) {
          disposers.push(e);
          continue;
        }
        // istanbul ignore next
        throw e; // happend while abort.
      }
    }
    throw new TaskSuspended(() => {
      settled = true;
      disposers.forEach((x) => x.abort());
    });
  };
}

// it's the opposite of any!
export function* all<T>(tasks: Iterable<T>): Runnable<Resolve<T>[]> {
  return yield (next) => {
    let count = 0,
      succeedCount = 0,
      settled = false;
    const results: any[] = [];
    const disposers: TaskSuspended[] = [];
    for (const task of tasks) {
      try {
        const closureIndex = count++;
        const result = executeRunnableTask(resolve(task), (result) => {
          if (settled) return;
          if (result.type === 'error') {
            settled = true;
            disposers.forEach((x) => x.abort());
            next(result);
          } else if (result.type === 'fulfill') {
            succeedCount++;
            results[closureIndex] = result.value;
            if (count === succeedCount) {
              next(__fulfill(results));
              // no necessary to dispose
            }
          }
        });
        if (result.type === 'error') {
          settled = true;
          disposers.forEach((x) => x.abort());
          return result;
        } else {
          if (result.type === 'fulfill') {
            succeedCount++;
            results[closureIndex] = result.value;
          }
        }
      } catch (e) {
        if (e instanceof TaskSuspended) {
          disposers.push(e);
          continue;
        }
        // istanbul ignore next
        throw e; // happend while abort
      }
    }
    if (count === succeedCount) {
      return __fulfill(results);
    }
    throw new TaskSuspended(() => {
      settled = true;
      disposers.forEach((x) => x.abort());
    });
  };
}

type TaskSettlement<T> =
  | {
      status: 'fulfilled';
      value: T;
    }
  | {
      status: 'rejected';
      reason?: any;
    };

export function* allSettled<T>(
  tasks: Iterable<T>
): Runnable<TaskSettlement<Resolve<T>>[]> {
  return yield (next) => {
    let count = 0,
      settledCount = 0,
      settled = false;
    const results: TaskSettlement<any>[] = [];
    const disposers: TaskSuspended[] = [];
    const handle = (currentIndex: number, result: TaskResult) => {
      settledCount++;
      switch (result.type) {
        case 'fulfill':
          results[currentIndex] = {
            status: 'fulfilled',
            value: result.value,
          };
          break;
        case 'error':
          results[currentIndex] = {
            status: 'rejected',
            reason: result.error,
          };
          break;
      }
    };
    for (const task of tasks) {
      try {
        const currentIndex = count++;
        const result = executeRunnableTask(resolve(task), (result) => {
          if (settled) return; // ignore
          handle(currentIndex, result);
          if (settledCount === count) {
            next(__fulfill(results));
          }
        });
        handle(currentIndex, result);
      } catch (e) {
        if (e instanceof TaskSuspended) {
          disposers.push(e);
          continue;
        }
        // istanbul ignore next
        throw e;
      }
    }
    if (settledCount === count) {
      return __fulfill(results);
    }
    throw new TaskSuspended(() => {
      settled = true;
      disposers.forEach((x) => x.abort());
    });
  };
}
