import {
  executeRunnableBlock,
  executeRunnableTask,
  TaskSuspended,
  __fulfill,
  __break,
  __continue,
  __return,
  resolve,
  __error,
  __abort_all,
} from './task';
import {
  Runnable,
  RunnableBlock,
  UnaryRunnableBlock,
  RunnableGenerator,
  CompletionType,
  TaskResult,
} from './types';

// @ts-ignore
function* _return<T>(value?: T): Runnable<never> {
  yield () => __return(value);
}
// @ts-ignore
function* _break(label?: string): Runnable<never> {
  yield () => __break(label);
}
// @ts-ignore
function* _continue(label?: string): Runnable<never> {
  yield () => __continue(label);
}

function _while(
  label: string,
  condition: () => any,
  block: RunnableBlock<void>
): Runnable<void>;
function _while(
  condition: () => any,
  block: RunnableBlock<void>
): Runnable<void>;
function* _while(...args: any[]): Runnable<void> {
  const [label, condition, block]: [string, () => any, RunnableBlock<void>] =
    args.length > 2 ? (args as any) : [undefined, args[0], args[1]];
  yield (next) => {
    let currentDisposer: TaskSuspended | undefined = undefined;
    function whileloop() {
      while (condition()) {
        const result = executeRunnableBlock(block(), callback);
        if (result.type === 'complete') {
          if (result.completionType === CompletionType.Return) {
            return result;
          } else if (result.completionType === CompletionType.Break) {
            if (result.value !== label) return result;
            break;
          } else {
            if (result.value !== label) return result;
            continue;
          }
        } else if (result.type === 'error') {
          return result;
        }
      }
      return __fulfill(undefined);
    }
    function callback(result: TaskResult): void {
      currentDisposer = undefined;
      if (result.type === 'complete') {
        if (result.completionType === CompletionType.Return) {
          return next(result);
        } else if (result.completionType === CompletionType.Break) {
          if (result.value !== label) return next(result);
          return next(__fulfill(undefined));
        } else {
          if (result.value !== label) return next(result);
          // do nothing
        }
      } else if (result.type === 'error') {
        return next(result);
      }
      try {
        result = whileloop();
      } catch (taskSuspended) {
        currentDisposer = taskSuspended as TaskSuspended;
        return; // do nothing
      }
      return next(result);
    }
    try {
      return whileloop();
    } catch (e) {
      currentDisposer = e as TaskSuspended;
      throw new TaskSuspended(() => {
        /* istanbul ignore if: guard */if (!currentDisposer) return;
        currentDisposer.abort();
      });
    }
  };
}

const loop = (block: RunnableBlock<void>) => _while(() => true, block);

function* _block(label: string, block: RunnableBlock<void>): Runnable<void> {
  yield (next) => {
    const handle = (result: TaskResult) => {
      if (result.type === 'complete') {
        if (result.completionType === CompletionType.Break) {
          if (result.value !== label) return result;
          return __fulfill(undefined);
        }
      }
      return result;
    };
    const result = executeRunnableBlock(block(), (result) =>
      next(handle(result))
    );
    return handle(result);
  };
}

type SelectCase<T = any> = [
  Runnable<T>,
  ((payload: T) => Runnable<void>) | ((payload: T) => void)
];

class SelectBuilder implements Runnable<void> {
  constructor(
    protected readonly cases: SelectCase[],
    private readonly defaultCase?: () => Runnable<void> | void
  ) {}

  case<T>(
    awaited: any,
    block: UnaryRunnableBlock<void, T> | ((payload: T) => void)
  ): SelectBuilder {
    return new SelectBuilder(
      [...this.cases, [awaited, block]],
      this.defaultCase
    );
  }

  *[Symbol.iterator](): RunnableGenerator<void> {
    if (this.cases.length === 0 && this.defaultCase === undefined) {
      return;
    }
    const [block, payload]: [(value: any) => Runnable<any>, any] = yield (
      next
    ) => {
      let settled = false;
      const disposers: TaskSuspended[] = [];
      const cases: SelectCase[] = this.defaultCase
        ? [...this.cases, [resolve(undefined), this.defaultCase]]
        : this.cases;
      const handle = (
        result: TaskResult,
        block: (payload: any) => Runnable<void> | void
      ) => {
        settled = true;
        __abort_all(disposers);
        if (result.type === 'fulfill') {
          return __fulfill([block, result.value]);
        }
        return result;
      };
      for (const [awaited, block] of cases) {
        try {
          const result = executeRunnableTask(awaited, (result) => {
            if (settled) return;
            next(handle(result, block));
          });
          return handle(result, block);
        } catch (e: any) {
          // istanbul ignore else
          if (e instanceof TaskSuspended) {
            disposers.push(e);
            continue;
          }
          // istanbul ignore next
          throw e;
        }
      }
      throw new TaskSuspended(() => {
        settled = true;
        __abort_all(disposers);
      });
    };
    const e = block(payload);
    if (typeof e ==='object' && Symbol.iterator in e) {
      yield* e;
    }
  }
}

class SelectBuilderWithDefault extends SelectBuilder {
  constructor(cases: SelectCase[]) {
    super(cases, undefined);
  }

  case<T>(
    awaited: Runnable<T>,
    block: UnaryRunnableBlock<void, T> | ((payload: T) => void)
  ): SelectBuilderWithDefault {
    return new SelectBuilderWithDefault([...this.cases, [awaited, block]]);
  }

  default(block: RunnableBlock<void> | (() => void)): SelectBuilder {
    return new SelectBuilder(this.cases, block);
  }
}

export const ControlStatements = {
  break: _break,
  continue: _continue,
  return: _return,
  while: _while,
  loop,
  block: _block,
  select: new SelectBuilderWithDefault([]),
};
