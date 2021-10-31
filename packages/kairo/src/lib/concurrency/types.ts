export type TaskYieldable = (
  asyncControlPoint: (result: TaskResult) => void
) => TaskResult;
export type Runnable<T> = {
  [Symbol.iterator](): RunnableGenerator<T>;
};

export type RunnableGenerator<T> = Generator<TaskYieldable, T, any>;

export type RunnableBlock<T> = () => RunnableGenerator<T>;
export type UnaryRunnableBlock<T, Arg> = (payload: Arg) => RunnableGenerator<T>;

export type TaskResult =
  | TaskFulfillResult
  | TaskErrorResult
  | TaskCompleteResult;

export type TaskFulfillResult = {
  type: 'fulfill';
  value: any;
};

export type TaskErrorResult = {
  type: 'error';
  error: any;
};

export type TaskCompleteResult = {
  type: 'complete';
  value?: any;
  completionType: CompletionType;
};

export const enum TaskResultType {
  Normal,
  Error,
  Complete,
}

export const enum CompletionType {
  Return = 1,
  Break = 2,
  Continue = 4,
}
