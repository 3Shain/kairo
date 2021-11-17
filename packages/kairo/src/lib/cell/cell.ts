import { identity, noop } from '../misc';
import {
  Subscribable,
  Symbol_observable,
  Subscription,
  PartialObserver,
} from '../types';
import {
  createMemo,
  createReaction,
  createData,
  Data,
  executeReaction,
  Reaction as _Reaction,
  setData,
  accessReferenceValue,
  BitFlags,
} from './internal';

export class Cell<T> {
  static of<T>(initial: T) {
    return new Cell(createData(initial));
  }

  /**  @internal */
  constructor(/**  @internal */ public internal: Data<T>) {}

  get current(): T {
    return accessReferenceValue(this.internal);
  }

  [Symbol_observable]() {
    return this;
  }

  [Symbol.toStringTag] = 'Cell';

  map<R>(fn: (value: T) => R): Cell<R> {
    return new Cell(createMemo(($) => fn($(this.internal))));
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
      reaction.track((t) => t(this));
      return () => reaction.dispose();
    }).subscribe(...params);
  }
}

function createTrackFn<T>($: (data: Data<T>) => T) {
  const ret = (cell: Cell<T>) => $(cell.internal);
  Object.defineProperties(ret, {
    error: {
      value: (cell: Cell<T>) => {
        try {
          ret(cell);
          return null;
        } catch (e) {
          return e;
        }
      },
    },
  });
  return ret as Track;
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

export type Track = {
  <C>(cell: Cell<C>): C;
  error(cell: Cell<any>): any;
};

declare var Observable: ObservableConstructor;

export class Reaction {
  /**  @internal */
  internal: _Reaction;

  constructor(callback: () => void) {
    this.internal = createReaction(callback);
  }

  /**
   *
   * @param program
   * @returns return value of `program`
   * @throws User-land errors in program()
   */
  track<T>(program: ($: Track) => T) {
    return executeReaction<T>(this.internal, ($) => program(createTrackFn($)));
  }

  dispose() {
    executeReaction(this.internal, noop);
  }
}

export class IncrementalReaction {
  /**  @internal */
  internal: _Reaction;

  constructor(callback: () => void) {
    this.internal = createReaction(callback);
  }

  track<T>(program: ($: Track) => T) {
    return executeReaction<T>(this.internal, ($) => program(createTrackFn($)));
  }

  continue<T>(program: ($: Track) => T) {
    return executeReaction<T>(this.internal, (t) => {
      for (const x of this.getHistoryReads()) {
        t(x);
      }
      return program(createTrackFn(t));
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
    executeReaction(this.internal, noop);
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
  expr: ($: Track) => T,
  initial?: T,
  options?: {
    comparator: (a: T, b: T) => boolean;
  }
): Cell<T> {
  return new Cell(
    createMemo((t) => expr(createTrackFn(t)), options?.comparator, initial)
  );
}

type Unwrap<T> = {
  [Key in keyof T]: T[Key] extends Cell<infer CellType> ? CellType : T[Key];
};

const d = (cell: Cell<any>, track: Track) => track(cell);

export function combined<TArray extends any[]>(
  array: TArray
): Cell<Unwrap<TArray>>;
export function combined<TObject extends object>(
  object: TObject
): Cell<Unwrap<TObject>>;
export function combined(obj: any) {
  if (obj instanceof Array) {
    const elementMap = obj.map((item) => (item instanceof Cell ? d : identity));
    return computed(($) => elementMap.map((x, i) => x(obj[i], $)));
  } /* istanbul ignore else: simple */ else if (
    typeof obj === 'object' &&
    obj !== null
  ) {
    const entryMap = Object.entries(obj).map(
      ([key, value]) =>
        (value instanceof Cell ? [key, d, value] : [key, identity, value]) as [
          string,
          Function,
          any
        ]
    );
    return computed(($) =>
      Object.fromEntries(
        entryMap.map(([key, map, value]) => {
          return [key, map(value, $)];
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

export function isCellCurrentEqualTo(
  cell: Cell<unknown>,
  value: any,
  checkError: boolean = false
) {
  if (checkError) {
    return cell.internal.flags & BitFlags.ValueIsError
      ? Object.is(cell.internal.value, value)
      : value === null;
  }
  return cell.internal.flags & BitFlags.ValueIsError
    ? false
    : cell.internal.cp(cell.internal.value, value);
}
