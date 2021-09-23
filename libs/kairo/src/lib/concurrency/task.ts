import {
  Action,
  Subscribable,
  Symbol_observable,
  TeardownLogic,
} from '../types';
import { doCleanup, noop } from '../misc';
import { CanceledError, CancellablePromise } from './promise';
import { AsyncRunnable, Runnable, TaskYieldable } from './types';

export function executeRunnable<T>(
  runnable: Runnable<T>,
  onsuccess: Action<T>,
  onfailure: Action<any>
): TeardownLogic {
  let currentDisposer: Function | null = null;

  const iter = runnable[Symbol.iterator]();
  let settled = false;

  function takeControl(yieldedObject: TaskYieldable<T>) {
    try {
      if (typeof yieldedObject === 'function') {
        //bind sideEffect
        let synchronous = true; // closure callback
        let innerSettled = false;
        let synchronousResult: {
          $$RESOLVE?: boolean;
          $$REJECT?: boolean;
          $$VALUE: any;
        } | null = null;
        function tryResolve(value: any) {
          if (innerSettled) return;
          innerSettled = true;
          if (synchronous) {
            synchronousResult = {
              $$RESOLVE: true,
              $$VALUE: value,
            };
          } else {
            resumeTask(value);
          }
        }
        function tryReject(error: any) {
          if (innerSettled) return;
          innerSettled = true;
          if (synchronous) {
            synchronousResult = {
              $$REJECT: true,
              $$VALUE: error,
            };
          } else {
            throwTask(error);
          }
        }
        const maybeDisposer = yieldedObject(tryResolve, tryReject); //might raise an error.
        if (synchronousResult !== null) {
          throw synchronousResult!;
        }
        currentDisposer = () => {
          // if (innerSettled) return; // no need this line: currentDisposer
          // is guaranteed to execute only once.
          doCleanup(maybeDisposer); // maybe raise an error.
          tryReject(new CanceledError());
        };
        synchronous = false;
      } else {
        throw new TypeError(
          'Invalid object yielded. Are you missing an asterisk(*) after `yield`?'
        );
      }
    } catch (e: any) {
      if (e.$$RESOLVE === true) {
        return resumeTask(e.$$VALUE);
      } else if (e.$$REJECT === true) {
        return throwTask(e.$$VALUE);
      } else {
        return throwTask(e);
      }
    }
  }

  function resumeTask(resumeValue: any): void {
    currentDisposer = null;
    let result: ReturnType<typeof iter.next>;
    try {
      result = iter.next(resumeValue);
    } catch (e) {
      return throwTask(e);
    }

    if (result.done) {
      settled || ((settled = true), onsuccess(result.value));
      return;
    } else {
      takeControl(result.value as any);
    }
  }

  function throwTask(error: any): void {
    currentDisposer = null;
    let result: ReturnType<typeof iter.throw>;
    try {
      result = iter.throw(error);
    } catch (e) {
      if (error === e) {
        settled || ((settled = true), onfailure(e));
        return;
      } else {
        return throwTask(e);
      }
    }
    if (result.done) {
      settled || ((settled = true), onsuccess(result.value));
      return;
    }
    takeControl(result.value as any);
  }

  resumeTask(undefined); //start synchronously.

  return () => {
    if (!settled) {
      try {
        currentDisposer?.();
      } catch (e) {
        if (!(e instanceof CanceledError)) {
          throw e;
        }
      } finally {
        settled = true;
      }
    }
  };
}

type InferPromise<C> = C extends Promise<infer D>? D:unknown;

export function executeAsyncRunnable<T>(
  runnable: AsyncRunnable<T>,
  onsuccess: Action<T>,
  onfailure: Action<any>
): TeardownLogic {
  let currentDisposer: Function | null = null;

  const iter = runnable[Symbol.asyncIterator]();
  let settled = false;

  function takeControl(yielded: TaskYieldable<T>) {
    try {
      if (typeof yielded === 'function') {
        //bind sideEffect
        let synchronous = true; // closure callback
        let innerSettled = false;
        let synchronousResult: {
          $$RESOLVE?: boolean;
          $$REJECT?: boolean;
          $$VALUE: any;
        } | null = null;
        function tryResolve(value: any) {
          if (innerSettled) return;
          innerSettled = true;
          if (synchronous) {
            synchronousResult = {
              $$RESOLVE: true,
              $$VALUE: value,
            };
          } else {
            resumeTask(value);
          }
        }
        function tryReject(error: any) {
          if (innerSettled) return;
          innerSettled = true;
          if (synchronous) {
            synchronousResult = {
              $$REJECT: true,
              $$VALUE: error,
            };
          } else {
            throwTask(error);
          }
        }
        const maybeDisposer = yielded(tryResolve, tryReject); //might raise an error.
        if (synchronousResult !== null) {
          throw synchronousResult!;
        }
        currentDisposer = () => {
          // if (innerSettled) return; // no need this line: currentDisposer
          // is guaranteed to execute only once.
          doCleanup(maybeDisposer); // maybe raise an error.
          innerSettled || tryReject(new CanceledError());
          // innerSettled = true;
        };
        synchronous = false;
      } else {
        throw new TypeError(
          'Invalid object yielded. Are you missing an asterisk(*) after `yield`?'
        );
      }
    } catch (e: any) {
      if (e.$$RESOLVE === true) {
        return resumeTask(e.$$VALUE);
      } else if (e.$$REJECT === true) {
        return throwTask(e.$$VALUE);
      } else {
        return throwTask(e);
      }
    }
  }

  async function resumeTask(resumeValue: any): Promise<void> {
    currentDisposer = null;
    let result: InferPromise<ReturnType<typeof iter.next>>;
    try {
      result = await iter.next(resumeValue);
    } catch (e) {
      return throwTask(e);
    }

    if (result.done) {
      settled || ((settled = true), onsuccess(result.value));
      return;
    } else {
      takeControl(result.value as any);
    }
  }

  async function throwTask(error: any): Promise<void> {
    currentDisposer = null;
    let result: InferPromise<ReturnType<typeof iter.throw>>;
    try {
      result = await iter.throw(error);
    } catch (e) {
      if (error === e) {
        settled || ((settled = true), onfailure(e));
        return;
      } else {
        return throwTask(e);
      }
    }
    if (result.done) {
      settled || ((settled = true), onsuccess(result.value));
      return;
    }
    takeControl(result.value as any);
  }

  resumeTask(undefined); //start synchronously.

  return () => {
    if (!settled) {
      try {
        currentDisposer?.();
      } catch (e) {
        if (!(e instanceof CanceledError)) {
          throw e;
        }
      } finally {
        settled = true;
      }
    }
  };
}

type GeneratorReturnType<T> = T extends () => Runnable<infer R> ? R : undefined;

export interface Task<T> extends PromiseLike<T>, Runnable<T> {
  cancel(): void;
}

// bug: type inference breaks when calling itself.
export function task<TaskFn extends (...args: any[]) => Runnable<any>>(
  taskFn: TaskFn
) {
  return function (...params: any[]) {
    return new CancellablePromise((resolve, reject) => {
      return executeRunnable(
        taskFn.call(undefined, ...params),
        resolve,
        reject
      );
    });
  } as (...params: Parameters<TaskFn>) => Task<GeneratorReturnType<TaskFn>>;
}

export function start<T>(runnable: Runnable<T>) {
  return new CancellablePromise<T>((resolve, reject) => {
    return executeRunnable(runnable, resolve, reject);
  });
}

export function* delay(time: number): Runnable<void> {
  return (yield (resume) => {
    const id = setTimeout((s) => resume(s), time);
    return () => clearTimeout(id);
  }) as void;
}

export function* timeout(time: number): Runnable<void> {
  return (yield (_, reject) => {
    const id = setTimeout((s) => reject(new Error('Timeout')), time);
    return () => clearTimeout(id);
  }) as void;
}

/* c8 ignore next 6 */
export function* nextAnimationFrame(): Runnable<number> {
  return (yield (resume) => {
    const id = requestAnimationFrame(resume as any);
    return () => cancelAnimationFrame(id);
  }) as number;
}

export class Semaphore {
  private currentNum = 0;
  private queue: Function[] = [];

  constructor(public readonly maxConcurrency: number) {}

  get free() {
    return this.currentNum < this.maxConcurrency;
  }

  *waitOne(): Runnable<void> {
    if (this.currentNum >= this.maxConcurrency) {
      yield* new CancellablePromise((resolve) => {
        this.queue.push(resolve);
        return () => this.queue.splice(this.queue.indexOf(resolve), 1); // resolve definitely exist.
      });
      // a free space is gurantted.
    }
    this.currentNum++;
    return;
  }

  // this is an action
  release() {
    if (this.currentNum === 0) {
      return;
    }
    this.currentNum--;
    // trigger?
    if (this.queue.length) {
      this.queue.shift()!(); // a microtask is scheduled.
    }
  }
}

function resolve<T>(thenable: PromiseLike<T>): Runnable<T>;
function resolve<T>(observable: Subscribable<T>): Runnable<T>;
function resolve<T>(runnable: Runnable<T>): Runnable<T>;
function resolve<T extends object>(value: T): Runnable<never>;
function resolve<T>(value: T): Runnable<T>;
function* resolve(obj: any): Runnable<any> {
  if (typeof obj === 'object' && obj !== null) {
    if (Symbol.iterator in obj) {
      return yield* obj as Runnable<any>;
    } else if ('then' in obj) {
      return yield (resolve, reject) => {
        (obj as PromiseLike<any>).then(resolve, reject);
        return noop;
      };
    } else if (Symbol_observable in obj) {
      return yield (resolve, reject) => {
        let lastEmit: unknown = undefined;
        const subscription = (obj as any)[Symbol_observable]().subscribe(
          (next: unknown) => {
            lastEmit = next;
          },
          (error: unknown) => reject(error),
          () => {
            resolve(lastEmit);
          }
        );
        return () => subscription.unsubscribe();
      };
    } else {
      return yield (_, reject) => {
        reject(new TypeError("Can't resolve object"));
        return noop;
      };
    }
  } else {
    return yield (resolve) => {
      resolve(obj);
      return noop;
    };
  }
}

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

function* any<T>(tasks: Iterable<T>): Runnable<ResolveAll<T>> {
  return yield (success, fail) => {
    let count = 0;
    const errors: any[] = [];
    const disposers: TeardownLogic[] = [];
    let sync = true;
    let errorCount = 0;
    for (const task of tasks) {
      const currentIndex = count;
      try {
        disposers.push(
          executeRunnable(
            resolve(task),
            (value) => {
              if (sync) throw value;
              success(value as T);
              disposers.forEach((x) => x()); // async
            },
            (error) => {
              errorCount++;
              errors[currentIndex] = error;
              if (!sync) {
                if (errorCount === count) {
                  fail(new AggregateError(errors, 'All task failed'));
                }
              }
            }
          )
        );
      } catch (value) {
        success(value as T);
        disposers.forEach((x) => x()); // sync
        return;
      }
      count++;
    }
    sync = false;
    if (errorCount === count) {
      return fail(new AggregateError(errors, 'All task failed'));
    }

    return () => {
      fail(new CanceledError());
      disposers.forEach((x) => x());
    };
  };
}

function* race<T>(tasks: Iterable<T>): Runnable<ResolveAll<T>> {
  return yield (success, fail) => {
    const disposers: TeardownLogic[] = [];
    let sync = true;
    for (const task of tasks) {
      try {
        disposers.push(
          executeRunnable(
            resolve(task),
            (value) => {
              if (sync) {
                throw {
                  $$RESOLVE: true,
                  $$VALUE: value,
                };
              }
              success(value as T);
              disposers.forEach((x) => x()); // async
            },
            (error) => {
              if (sync)
                throw {
                  $$REJECT: true,
                  $$VALUE: error,
                };
              fail(error as T);
              disposers.forEach((x) => x()); // async
            }
          )
        );
      } catch (value: any) {
        if (value.$$RESOLVE === true) {
          success(value.$$VALUE as T);
        } else if (value.$$REJECT === true) {
          fail(value.$$VALUE);
        } else {
          fail(value); // highly impossible, but for insurance
        }
        sync = false; // NB
        disposers.forEach((x) => x()); // sync
        return;
      }
    }
    sync = false;

    return () => {
      fail(new CanceledError());
      disposers.forEach((x) => x());
    };
  };
}

// it's the opposite of any!
function* all<T>(tasks: Iterable<T>): Runnable<Resolve<T>[]> {
  return yield (success, fail) => {
    let count = 0;
    const result: any[] = [];
    const disposers: TeardownLogic[] = [];
    let sync = true;
    let succeedCount = 0;
    for (const task of tasks) {
      const currentIndex = count;
      try {
        disposers.push(
          executeRunnable(
            resolve(task),
            (value) => {
              succeedCount++;
              result[currentIndex] = value;
              if (!sync) {
                if (succeedCount === count) {
                  success(result);
                }
              }
            },
            (error) => {
              if (sync) throw error;
              fail(error);
              disposers.forEach((x) => x()); //async
            }
          )
        );
      } catch (e) {
        fail(e);
        sync = false;
        disposers.forEach((x) => x()); //sync
        return;
      }
      count++;
    }
    sync = false;
    if (succeedCount === count) {
      return success(result);
    }

    return () => {
      fail(new CanceledError());
      disposers.forEach((x) => x());
    };
  };
}

type TaskSettlement<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      value: any;
    };

function* allSettled<T>(
  tasks: Iterable<T>
): Runnable<TaskSettlement<Resolve<T>>[]> {
  return yield (success, fail) => {
    let count = 0;
    const result: TaskSettlement<any>[] = [];
    const disposers: TeardownLogic[] = [];
    let sync = true;
    let settledCount = 0;
    for (const task of tasks) {
      const currentIndex = count;
      try {
        disposers.push(
          executeRunnable(
            resolve(task),
            (value) => {
              settledCount++;
              result[currentIndex] = {
                success: true,
                value,
              };
              if (!sync) {
                if (settledCount === count) {
                  success(result);
                }
              }
            },
            (error) => {
              settledCount++;
              result[currentIndex] = {
                success: false,
                value: error,
              };
              if (!sync) {
                if (settledCount === count) {
                  success(result);
                }
              }
            }
          )
        );
      } catch (e) {
        // almost you can catch nothing, but for insurance
        fail(e);
        disposers.forEach((x) => x());
        return;
      }
      count++;
    }
    sync = false;
    if (settledCount === count) {
      return success(result);
    }
    return () => {
      fail(new CanceledError());
      disposers.forEach((x) => x());
    };
  };
}

export { resolve, all, allSettled, any, race };
