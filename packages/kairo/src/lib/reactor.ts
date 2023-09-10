interface StateMutation<T> {}

interface TaskYield {
  next(): void;
}

export interface ReactorFunction<State, InitialState> {
  (initial: InitialState): Generator<TaskYield | StateMutation<State>, State>;
}

export type GetReactorStateType<T> = T extends ReactorFunction<infer C, any>
  ? C
  : never;

export class Machine {
  machine: Generator<TaskYield | StateMutation<any>, any>;
  constructor(fn: ReactorFunction<any, any>, init: any) {
    this.machine = fn(init);
    this.machine.next(undefined);
  }

  progress() {}

  pause() {}
}
