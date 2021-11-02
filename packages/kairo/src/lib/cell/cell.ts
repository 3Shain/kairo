import { identity } from '../misc';
import {
  Subscribable,
  Symbol_observable,
  Subscription,
  PartialObserver,
} from '../types';
import {
  accessValue,
  cleanupMemo,
  createMemo,
  createReaction,
  createData,
  Data,
  executeReaction,
  Reaction as _Reaction,
  setData,
  untrack,
} from './internal';

export class Cell<T> {
  static of<T>(initial: T) {
    return new Cell(createData(initial));
  }

  static track<T>(cell: Cell<T>) {
    return accessValue(cell.internal, true);
  }

  constructor(protected internal: Data<T>) {}

  get current(): T {
    return accessValue(this.internal, false);
  }

  [Symbol_observable]() {
    return this;
  }

  [Symbol.toStringTag] = 'Cell';

  map<R>(fn: (value: T) => R): Cell<R> {
    return computed(() => untrack(fn, accessValue(this.internal, true)));
  }

  /**
   * @deprecated Should be only used for interop.
   */
  subscribe(observer?: PartialObserver<T>): Subscription;
  /**
   * @deprecated Should be only used for interop.
   */
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Subscription;
  /**
   * @deprecated Should be only used for interop.
   */
  subscribe(...params: any[]): Subscription {
    return new Observable<T>((observer) => {
      const reaction = new Reaction(() => {
        try {
          observer.next(this.current);
        } catch (e) {
          observer.error(e);
        }
      });
      observer.next(this.current);
      reaction.track(() => accessValue(this.internal, true));
      return () => reaction.dispose();
    }).subscribe(...params);
  }
}

interface Observable<T> extends Subscribable<T> {}

interface ObservableConstructor {
  new <T>(
    subscriber: (observer: SubscriptionObserver<T>) => () => void
  ): Observable<T>;
}

interface SubscriptionObserver<T> {
  next: (value: T) => void;

  error: (errorValue: any) => void;

  complete: () => void;

  readonly closed: boolean;
}

declare var Observable: ObservableConstructor;

export class Reaction {
  private internal: _Reaction;

  constructor(callback: () => void) {
    this.internal = createReaction(callback);
  }

  /**
   *
   * @param program
   * @returns return value of `program`
   * @throws User-land errors in program()
   */
  track<T>(program: ($: typeof Cell.track) => T) {
    return executeReaction<T>(this.internal, () => program(Cell.track));
  }

  dispose() {
    cleanupMemo(this.internal);
  }
}

export class IncrementalReaction {
  private internal: _Reaction;

  constructor(callback: () => void) {
    this.internal = createReaction(callback);
  }

  track<T>(program: ($: typeof Cell.track) => T) {
    return executeReaction<T>(this.internal, () => program(Cell.track));
  }

  continue<T>(program: ($: typeof Cell.track) => T) {
    return executeReaction<T>(this.internal, () => {
      for (const x of this.getHistoryReads()) {
        accessValue(x, true);
      }
      return program(Cell.track);
    });
  }

  private *getHistoryReads() {
    let source = this.internal.fs;
    while (source) {
      yield source.source;
      source = source.next;
    }
  }

  dispose() {
    cleanupMemo(this.internal);
  }
}

export function mutable<T>(
  initialValue: T,
  options?: {
    comparator: (a: T, b: T) => boolean;
  }
): [
  Cell<T>,
  (value: (T extends Function ? never : T) | ((current: T) => T)) => void
] {
  const internal = createData(initialValue, options?.comparator);
  return [
    new Cell(internal),
    (v) => {
      if (v instanceof Function) {
        setData(internal, v(internal.value!));
      } else {
        setData(internal, v);
      }
    },
  ];
}

export function computed<T>(
  expr: ($: typeof Cell.track) => T,
  options?: {
    comparator: (a: T, b: T) => boolean;
  }
): Cell<T> {
  return new Cell(createMemo(() => expr(Cell.track), options?.comparator));
}

type Unwrap<T> = {
  [Key in keyof T]: T[Key] extends Cell<infer CellType> ? CellType : T[Key];
};

export function combined<TArray extends any[]>(
  array: TArray
): Cell<Unwrap<TArray>>;
export function combined<TObject extends object>(
  object: TObject
): Cell<Unwrap<TObject>>;
export function combined(obj: any) {
  if (obj instanceof Array) {
    const elementMap = obj.map((item) =>
      item instanceof Cell ? Cell.track : identity
    );
    return computed(() => elementMap.map((x, i) => x(obj[i])));
  } /* istanbul ignore else: simple */ else if (
    typeof obj === 'object' &&
    obj !== null
  ) {
    const entryMap = Object.entries(obj).map(
      ([key, value]) =>
        (value instanceof Cell
          ? [key, Cell.track, value]
          : [key, identity, value]) as [string, Function, any]
    );
    return computed(() =>
      Object.fromEntries(
        entryMap.map(([key, map, value]) => {
          return [key, map(value)];
        })
      )
    );
  }
  // istanbul ignore next: simple
  throw new TypeError(
    __DEV__
      ? `\`combined\` excepts an array or non-null object but ${
          obj === null ? typeof obj : 'null'
        } is provided.`
      : undefined
  );
}
