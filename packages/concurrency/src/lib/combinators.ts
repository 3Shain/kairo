import type { Subscribable } from 'kairo';
import {
  resolve,
  TaskSuspended,
  __fulfill,
  executeRunnableTask,
  __abort_all,
  __error,
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
      const closureIndex = count++;
      let result: ReturnType<typeof executeRunnableTask>;
      try {
        result = executeRunnableTask(resolve(task), (result) => {
          if (result.type === 'fulfill') {
            next(result);
            __abort_all(disposers);
          } else {
            errorCount++;
            errors[closureIndex] = result.error;
            if (count === errorCount) {
              next(__error(new AggregateError(errors, 'All tasks failed.')));
            }
          }
        });
      } catch (taskSuspended) {
        disposers.push(taskSuspended as TaskSuspended);
        continue;
      }
      if (result.type === 'fulfill') {
        __abort_all(disposers);
        return result;
      } else {
        errorCount++;
        errors[closureIndex] = result.error;
      }
    }
    if (count === errorCount) {
      return __error(new AggregateError(errors, 'All tasks failed.'));
    }
    throw new TaskSuspended(() => {
      __abort_all(disposers);
    });
  };
}

export function* race<T>(tasks: Iterable<T>): Runnable<ResolveAll<T>> {
  return yield (next) => {
    let settled = false;
    const disposers: TaskSuspended[] = [];
    for (const task of tasks) {
      let result: ReturnType<typeof executeRunnableTask>;
      try {
        result = executeRunnableTask(resolve(task), (result) => {
          if (settled) return;
          settled = true;
          __abort_all(disposers);
          next(result);
        });
      } catch (taskSuspended: any) {
        disposers.push(taskSuspended as TaskSuspended);
        continue;
      }
      settled = true;
      __abort_all(disposers);
      return result;
    }
    throw new TaskSuspended(() => {
      settled = true;
      __abort_all(disposers);
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
      const closureIndex = count++;
      let result: ReturnType<typeof executeRunnableTask>;
      try {
        result = executeRunnableTask(resolve(task), (result) => {
          if (settled) return;
          if (result.type === 'error') {
            settled = true;
            __abort_all(disposers);
            next(result);
          } else {
            succeedCount++;
            results[closureIndex] = result.value;
            if (count === succeedCount) {
              next(__fulfill(results));
              // no necessary to dispose
            }
          }
        });
      } catch (e) {
        disposers.push(e as TaskSuspended);
        continue;
      }
      if (result.type === 'error') {
        settled = true;
        __abort_all(disposers);
        return result;
      } else {
        succeedCount++;
        results[closureIndex] = result.value;
      }
    }
    if (count === succeedCount) {
      return __fulfill(results);
    }
    throw new TaskSuspended(() => {
      settled = true;
      __abort_all(disposers);
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
      } catch (taskSuspended) {
        disposers.push(taskSuspended as TaskSuspended);
        continue;
      }
    }
    if (settledCount === count) {
      return __fulfill(results);
    }
    throw new TaskSuspended(() => {
      settled = true;
      __abort_all(disposers);
    });
  };
}
