import { Symbol_observable, Subscribable, Cleanable } from 'kairo';
import { noop, doCleanup } from 'kairo';
import type {
  Runnable,
  TaskYieldable,
  TaskResult,
  RunnableGenerator,
  TaskCompleteResult,
  TaskErrorResult,
  TaskFulfillResult,
} from './types';
import { CompletionType } from './types';

export class AbortedError extends Error {
  name = 'AbortedError';
  constructor(message?: string) {
    super(/* istanbul ignore next: simple */message ?? 'Operation has been aborted');
  }
}

export class TaskKilledError extends Error {
  name = 'TaskKilledError';
  constructor() {
    super('Task has been killed since it can\'t be aborted gracefully.')
  }
}

let $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER: any = null;

export class AbortablePromise<T> extends Promise<T> implements Runnable<T> {
  public readonly abort: () => void;

  constructor(
    executor: (
      resolve: (value: T | PromiseLike<T>) => void,
      reject: (reason?: any) => void
    ) => Cleanable
  ) {
    super((resolve, reject) => {
      let settled = false;
      // disposer is guaranteed to be not executed after: 1.fulfilled 2.rejected 3.disposed once(which is also reject)
      // resolve in dispose? I think it's valid. And default behavior is reject after disposer executed, but user
      // can reject/resolve in disposer and default behavior is ignored.
      const dispose = executor(
        (v) => {
          resolve(v);
          settled = true;
        },
        (e) => {
          reject(e);
          settled = true;
        }
      );
      $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER = () => {
        if (settled) return;
        /* istanbul ignore else: no-op */if (dispose) doCleanup(dispose); // might become settled.
        settled = true;
        reject(new AbortedError());
      };
    });
    this.abort = $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER;
  }

  *[Symbol.iterator](): RunnableGenerator<T> {
    return yield (next) => {
      this.then(
        (value) => {
          next(__fulfill(value));
        },
        (reason) => {
          next(__error(reason));
        }
      );
      throw new TaskSuspended(() => this.abort());
    };
  }

  /**
   * Why AbortablePromise.then returns Promise but not AbortablePromise?
   *
   * Because Promise stands for deferred value. To abort a value doesn't make sense, but
   * to abort the side effect of fetching value is.
   * Because it's `a value` so you can `.then` a Promise as many times as you want.
   * And the side effect only executes once.
   * Now if a derived `Promise` is aborted, then should the `source` be aborted as well?
   * The answer is no. Otherwise the semantic of `deferred value` is broken.
   * To not invalidate the semantic, a possible solution is `don't care if aborted`
   *
   * But that's not desired behavior as we actually want to abort the side effect (ajax request/
   * multi-staged async process).
   *
   * Things got complex...
   *
   * So read Promise as deferred value. Then AbortablePromise is a Promise thus a deferred value as well.
   * Don't read Promise as a process to retrieve some values.
   * AbortablePromise provides the ability to manage side effects.
   */
}

export class TaskSuspended {
  private aborted: boolean = false;

  constructor(private readonly onAbort: () => void) {}

  abort() {
    /* istanbul ignore if: idempotent no-op */if (this.aborted) return;
    this.aborted = true;
    this.onAbort();
  }
}

export function executeRunnableBlock<T>(
  block: Runnable<T>,
  asyncContinuation: (result: TaskResult) => void = noop
): TaskResult {
  const tasks = block[Symbol.iterator]();

  let taskCurrentDisposer: TaskSuspended | undefined = undefined;

  let currentStep = 0;

  /**
   *
   * @param resumeP
   * @returns result
   * @throws {@link TaskSuspended}
   */
  function resumeTask(resumeP: TaskResult): TaskResult {
    let resumeValue: TaskResult = resumeP,
      yieldValue: TaskYieldable;
    while (true) {
      currentStep++;
      try {
        const yieldResult =
          resumeValue.type === 'fulfill'
            ? tasks.next(resumeValue.value)
            : resumeValue.type === 'error'
            ? tasks.throw(resumeValue.error)
            : tasks.return(resumeValue.value);
        if (yieldResult.done === true) {
          if (resumeValue.type === 'complete') {
            return resumeValue;
          }
          return __fulfill(yieldResult.value);
        }
        yieldValue = yieldResult.value;
      } catch (error) {
        // userland error
        return __error(error);
      }
      let stillSync = true;
      try {
        const closureTime = currentStep;
        resumeValue = yieldValue((asyncResult) => {
          if (stillSync) throw new TypeError('Illegal operation');
          if (closureTime < currentStep) return;
          taskCurrentDisposer = undefined;
          let result: TaskResult;
          try {
            result = resumeTask(asyncResult);
          } catch (taskSuspended) {
            return;
          }
          asyncContinuation(result);
        });
        stillSync = false;
      } catch (e) {
        stillSync = false;
        if (e instanceof TaskSuspended) {
          taskCurrentDisposer = e;
          throw e;
        }
        resumeValue = __error(e);
      }
    }
  }

  try {
    return resumeTask(__fulfill(undefined));
  } catch (taskSuspended) {
    throw new TaskSuspended(() => {
      if (taskCurrentDisposer === undefined) return;
      let result: TaskResult;
      try {
        result = resumeTask(__error(new AbortedError()));
      } catch (taskSuspended) {
        resumeTask(__return(undefined)); // kill
        (taskSuspended as TaskSuspended).abort();
        result = __error(new TaskKilledError());
      }
      // after resumeTask so any action inside is ignored.
      taskCurrentDisposer.abort();
      asyncContinuation(result);
    });
  }
}

export function executeRunnableTask<T>(
  runnable: Runnable<T>,
  asyncContinuation: (
    result: TaskFulfillResult | TaskErrorResult
  ) => void = noop
): TaskFulfillResult | TaskErrorResult {
  return __handle_task_complete(
    executeRunnableBlock(runnable, (result) =>
      asyncContinuation(__handle_task_complete(result))
    )
  );
}

export interface Task<T> extends AbortablePromise<T> {}

type GeneratorReturnType<T> = T extends () => Runnable<infer R> ? R : undefined;

// bug: type inference breaks when calling itself.
export function task<TaskFn extends (...args: any[]) => Runnable<any>>(
  taskFn: TaskFn
) {
  return function (...params: any[]) {
    return new AbortablePromise((resolve, reject) => {
      function handleResult(result: TaskFulfillResult | TaskErrorResult) {
        if (result.type === 'fulfill') {
          resolve(result.value);
        } else {
          reject(result.error);
        }
      }
      try {
        const result = executeRunnableTask(taskFn(...params), handleResult);
        handleResult(result);
      } catch (taskSuspended) {
        return taskSuspended as TaskSuspended;
      }
    });
  } as (...params: Parameters<TaskFn>) => Task<GeneratorReturnType<TaskFn>>;
}

export function* delay(ms?: number): Runnable<void> {
  return yield (next) => {
    const id = setTimeout(() => {
      next(__fulfill(undefined));
    }, ms);
    throw new TaskSuspended(() => {
      clearTimeout(id);
    });
  };
}

export function* timeout(ms?: number): Runnable<void> {
  return yield (next) => {
    const id = setTimeout(() => {
      next(__error(new Error('Timeout')));
    }, ms);
    throw new TaskSuspended(() => {
      clearTimeout(id);
    });
  };
}

/* istanbul ignore next: simple but hard to test */
export function* nextAnimationFrame(): Runnable<number> {
  return yield (next) => {
    const id = requestAnimationFrame((time) => {
      next(__fulfill(time));
    });
    throw new TaskSuspended(() => {
      cancelAnimationFrame(id);
    });
  };
}

export function resolve<T>(
  value: T | Runnable<T> | PromiseLike<T> | Subscribable<T>
): Runnable<T>;
export function* resolve(obj: any): Runnable<any> {
  if (typeof obj === 'object' && obj !== null) {
    if (Symbol.iterator in obj) {
      return yield* obj as Runnable<any>;
    } else if ('then' in obj) {
      return yield (next) => {
        Promise.resolve(obj).then(
          (value) => {
            next(__fulfill(value));
          },
          (error) => {
            next(__error(error));
          }
        );
        throw new TaskSuspended(noop);
      };
    } else if (Symbol_observable in obj) {
      return yield (next) => {
        let syncResult: TaskResult | undefined = undefined;
        let lastEmit: any = undefined;
        const handle = (result: TaskResult) => {
          if (syncResult) {
            next(result);
          } else {
            syncResult = result;
          }
        };
        const subscription = (obj as any)[Symbol_observable]().subscribe(
          (value: any) => {
            lastEmit = value;
          },
          (error: any) => handle(__error(error)),
          () => handle(__fulfill(lastEmit))
        );
        if (syncResult !== undefined) {
          subscription.unsubscribe();
          return syncResult;
        }
        syncResult = __fulfill(undefined);
        throw new TaskSuspended(/* istanbul ignore next: simple */() => subscription.unsubscribe());
      };
    }
  }
  return yield () => {
    return __fulfill(obj);
  };
}
export function __error(error: any): TaskErrorResult {
  return { type: 'error', error };
}

export function __fulfill(value: any): TaskFulfillResult {
  return { type: 'fulfill', value };
}

export function __return(value: any): TaskCompleteResult {
  return { type: 'complete', value, completionType: CompletionType.Return };
}

export function __break(label?: string): TaskCompleteResult {
  return {
    type: 'complete',
    value: label,
    completionType: CompletionType.Break,
  };
}

export function __continue(label?: string): TaskCompleteResult {
  return {
    type: 'complete',
    value: label,
    completionType: CompletionType.Continue,
  };
}

export function __handle_task_complete(
  result: TaskResult
): TaskFulfillResult | TaskErrorResult {
  if (result.type === 'complete') {
    switch (result.completionType) {
      case CompletionType.Return:
        return __fulfill(result.value);
      case CompletionType.Break:
      case CompletionType.Continue:
        return __error(new TypeError('Illegal statement'));
    }
  }
  return result;
}

// istanbul ignore next: simple
export function __abort_all(disposers: TaskSuspended[]) {
  const errors = disposers.reduce((collect, d) => {
    try {
      d.abort();
    } catch (e) {
      collect.push(e);
    }
    return collect;
  }, [] as any[]);
  if (errors.length > 0) {
    if (errors.length === 1) {
      throw errors[0];
    }
    throw new AggregateError(errors);
  }
}
