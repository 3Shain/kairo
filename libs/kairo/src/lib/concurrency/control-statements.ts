import {
  executeRunnableBlock,
  executeRunnableTask,
  TaskSuspended,
  __fulfill,
  resolve,
} from './task';
import {
  Runnable,
  RunnableBlock,
  UnaryRunnableBlock,
  RunnableGenerator,
  CompletionType,
  TaskResult,
} from './types';

function* _return<T>(value?: T): Runnable<never> {
  const o = {
    type: 'complete',
    value,
    completionType: CompletionType.Return,
  } as const;
  yield () => o;
  /* istanbul ignore next */
  throw 'stub';
}

const o0 = { type: 'complete', completionType: CompletionType.Break } as const;
function* _break(): Runnable<never> {
  yield () => o0;
  /* istanbul ignore next */
  throw 'stub';
}

const o1 = {
  type: 'complete',
  completionType: CompletionType.Continue,
} as const;
function* _continue(): Runnable<never> {
  yield () => o1;
  /* istanbul ignore next */
  throw 'stub';
}

function* _while(
  condition: () => boolean,
  block: RunnableBlock<void>
): Runnable<void> {
  yield (next) => {
    let currentDisposer: TaskSuspended | undefined = undefined;
    function whileloop() {
      while (condition()) {
        const result = executeRunnableBlock(block(), callback);
        if (result.type === 'complete') {
          if (result.completionType === CompletionType.Return) {
            return result;
          } else if (result.completionType === CompletionType.Break) {
            break;
          } else if (result.completionType === CompletionType.Continue) {
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
          return next(__fulfill(undefined));
        } else if (result.completionType === CompletionType.Continue) {
          // do nothing
        }
      } else if (result.type === 'error') {
        return next(result);
      }
      try {
        result = whileloop();
      } catch (taskSuspended) {
        currentDisposer = taskSuspended as TaskSuspended;
        return; //nanimoshinai
      }
      return next(result);
    }
    try {
      return whileloop();
    } catch (e) {
      currentDisposer = e as TaskSuspended;
      throw new TaskSuspended(() => {
        if (!currentDisposer) return;
        currentDisposer.abort();
      });
    }
  };
}

const loop = (block: RunnableBlock<void>) => _while(() => true, block);

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
      for (const [awaited, block] of cases) {
        try {
          const ret = executeRunnableTask(awaited, (result) => {
            if (settled) return;
            settled = true;
            disposers.forEach((x) => x.abort());
            if (result.type === 'fulfill') {
              next(__fulfill([block, result.value]));
            } else {
              next(result);
            }
          });
          settled = true;
          disposers.forEach((x) => x.abort());
          if (ret.type === 'fulfill') {
            return __fulfill([block, ret.value]);
          }
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
        disposers.forEach((x) => x.abort());
      });
    };
    const e = block(payload);
    if (Symbol.iterator in e) {
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
  select: new SelectBuilderWithDefault([]),
};
