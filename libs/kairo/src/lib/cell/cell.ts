import { Symbol_observable, Cleanable, TeardownLogic } from '../types';
import {
  Data,
  accessData,
  createComputation,
  disposeWatcher,
  Computation,
  accessComputation,
  executeLazy,
  createData,
  setData,
  createLazy,
  createSuspended,
  watch,
  Flag,
} from './internal';
import { doCleanup, identity } from '../utils';
import { RunnableGenerator } from '../concurrency/types';

export class Cell<T> {
  constructor(protected internal: Data<T>) {}

  get value(): T {
    return accessData(this.internal);
  }

  [Symbol_observable]() {
    return this;
  }

  *[Symbol.iterator](): RunnableGenerator<T> {
    return yield (resolve) => {
      const unsub = this.watch((value) => {
        resolve(value);
        unsub();
      });
      return unsub;
    };
  }

  map<R>(mapFn: (value: T) => R): Cell<R> {
    const internal = createComputation(() => mapFn(this.value));
    return new ComputationalCell(internal);
  }

  watch(
    watchFn: (value: T) => Cleanable,
    options?: WatchOptions
  ): TeardownLogic {
    let lastDisposer: Cleanable = undefined;
    const watcher = watch(this.internal, () => {
      doCleanup(lastDisposer);
      lastDisposer = watchFn(this.internal.value!);
    });
    if (options?.immediate) {
      lastDisposer = watchFn(this.internal.value!);
    }
    return () => {
      doCleanup(lastDisposer);
      disposeWatcher(watcher!);
    };
  }

  /**
   * @deprecated Use watch.
   */
  subscribe(next: (value: T) => void) {
    const ret = this.watch(
      (v) => {
        next(v);
      },
      { immediate: true }
    );
    (ret as any).unsubscribe = ret;
    return ret as {
      (): void;
      unsubscribe(): void;
    };
  }
}

export interface WatchOptions {
  immediate?: boolean;
}

export class ComputationalCell<T> extends Cell<T> {
  constructor(internal: Computation<T>) {
    super(internal);
  }

  get value(): T {
    return accessComputation(this.internal as Computation);
  }
}

export class Lazy<T> {
  get stale() {
    return (this.internal.flags & Flag.Stale) > 0;
  }

  constructor(private internal: Computation<T>) {}

  execute(expr: (current: T) => T) {
    return executeLazy<T>(this.internal, expr);
  }

  watch(
    watchFn: (value: T) => Cleanable,
    options?: WatchOptions
  ): TeardownLogic {
    let lastDisposer: Cleanable = undefined;
    const watcher = watch(this.internal, () => {
      doCleanup(lastDisposer);
      lastDisposer = watchFn(this.internal.value!);
    });
    if (options?.immediate) {
      lastDisposer = watchFn(this.internal.value!);
    }
    return () => {
      doCleanup(lastDisposer);
      disposeWatcher(watcher!);
    };
  }
}

export function mutable<T>(
  initialValue: T
): [
  Cell<T>,
  (value: (T extends Function ? never : T) | ((current: T) => T)) => void
] {
  const internal = createData(initialValue);
  return [
    new Cell(internal),
    (v) => {
      if (v instanceof Function) {
        setData(internal, v(internal.value!), true);
      } else {
        setData(internal, v as any, true);
      }
    },
  ];
}

export function mutValue<T>(initialValue: T): [Cell<T>, (value: T) => void] {
  const internal = createData(initialValue);
  return [
    new Cell(internal),
    (v) => {
      setData(internal, v as any, true);
    },
  ];
}

export function lazy<T>(initial?: T) {
  return new Lazy<T>(createLazy(initial));
}

export function computed<T>(
  expr: () => T,
  options?: {
    static?: boolean;
    initial?: T;
  }
): Cell<T> {
  const internal = createComputation(expr, options);
  return new ComputationalCell(internal) as Cell<T>;
}

export function suspended<T, F = T>(expr: () => T, fallback: F): Cell<T> {
  const internal = createSuspended(expr, fallback);
  return new ComputationalCell(internal);
}

export function constant<T>(value: T) {
  return new Cell(createData(value));
}

export type UnwrapProperty<T> = T extends object
  ? {
      [P in keyof T]: T[P] extends Cell<infer C> ? C : T[P];
    }
  : T;

export function combined<A extends Array<Cell<any>>, R = UnwrapProperty<A>>(
  array: A,
  lifeFn?: (a: UnwrapProperty<A>) => R
): Cell<R>;
export function combined<
  C extends {
    [key: string]: Cell<any>;
  },
  R = UnwrapProperty<C>
>(obj: C, lifeFn?: (A: UnwrapProperty<C>) => R): Cell<R>;
export function combined(
  obj: object,
  lifeFn: (a: any) => any = identity
): Cell<any> {
  if (obj instanceof Array) {
    return computed(() => {
      return lifeFn(
        obj.map((x) => {
          return x.value;
        })
      );
    });
  }
  return computed(() => {
    return lifeFn(
      Object.fromEntries(
        Object.entries(obj).map(([key, value]) => {
          return [key, value.value];
        })
      )
    );
  });
}
