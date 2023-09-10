import { dirty, Node, __dev_next_prio } from './reactivity';

interface EventFlow<T> {
  [Symbol.iterator](): Iterator<never, T>;
}

interface Emitter<T> {
  (payload: T): void;
  <R>(payload: R, transformer: (source: R) => T): void;
  <R, R2>(
    payload: R,
    transformer_0: (source: R) => R2,
    transformer_1: (source: R2) => T
  ): void;
  <R, R2, R3>(
    payload: R,
    transformer_0: (source: R) => T,
    transformer_1: (source: R2) => R3,
    transformer_2: (source: R3) => T
  ): void;
  <R, R2, R3, R4>(
    payload: R,
    transformer_0: (source: R) => T,
    tranformer_1: (source: R2) => R3,
    transformer_2: (source: R3) => R4,
    transformer_3: (source: R4) => T
  ): void;
  /**
   * @deprecated Too many transformers. Please consider compose them.
   */
  (payload: any, ...transformers: ((source: any) => any)[]): void;
}

function defineEvent<T>(): [EventFlow<T>, Emitter<T>] {
  const node: Node & EventFlow<T> = {
    attr: 0,
    flags: 0,
    expr: () => 0,
    state: null,
    vstk: [null!],
    noe: null,
    last: null,
    is: Object.is,
    [Symbol.iterator]: function* () {
      return (yield node as never) as any as T;
    },
  };
  if (__DEV__) {
    node.__dev_prio = __dev_next_prio();
  }
  const emitter = (value: any, ...transformers: Function[]) => {
    dirty(node);
  };
  // throw 'oops';
  return [node, emitter];
}

export { defineEvent };
export type { Emitter };
