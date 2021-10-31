import { identity } from '../misc';
import {
  Subscribable,
  Symbol_observable,
  Subscription,
  PartialObserver,
} from '../types';
import {
  accessValue,
  accessRefValue,
  cleanupMemo,
  createMemo,
  createReaction,
  createData,
  Data,
  executeReaction,
  Reaction as _Reaction,
  setData,
} from './internal';

export class Cell<T> {
  static of<T>(initial: T) {
    return new Cell(createData(initial));
  }

  constructor(protected internal: Data<T>) {}

  get $(): T {
    return accessValue(this.internal);
  }

  get current(): T {
    return accessRefValue(this.internal);
  }

  [Symbol_observable]() {
    return this;
  }

  [Symbol.toStringTag] = 'Cell';

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
      reaction.track(() => this.$);
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

  get closed(): Boolean;
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
  track<T>(program: () => T) {
    return executeReaction<T>(this.internal, program);
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

  track<T>(program: () => T) {
    return executeReaction<T>(this.internal, program);
  }

  continue<T>(program: () => T) {
    const reaction = this.internal;
    return executeReaction<T>(this.internal, () => {
      for (const x of this.getHistoryReads()) {
        accessValue(x);
      }
      return program();
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
        setData(internal, v(internal.value!));
      } else {
        setData(internal, v);
      }
    },
  ];
}

export function computed<T>(expr: () => T): Cell<T> {
  return new Cell(createMemo(expr));
}

const getAndTrackCellValue = <T>(x: Cell<T>) => x.$;

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
      item instanceof Cell ? getAndTrackCellValue : identity
    );
    return computed(() => elementMap.map((x, i) => x(obj[i])));
  } /* istanbul ignore else: simple */ else if (
    typeof obj === 'object' &&
    obj !== null
  ) {
    const entryMap = Object.entries(obj).map(
      ([key, value]) =>
        (value instanceof Cell
          ? [key, getAndTrackCellValue, value]
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
