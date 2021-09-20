import { PartialObserver, Symbol_observable, Unsubscribable } from '../types';
import {
  accessValue,
  cleanupComputation,
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

  get value(): T {
    return accessValue(this.internal);
  }

  get error(): any {
    try {
      accessValue(this.internal);
      return null;
    } catch (e) {
      return e;
    }
  }

  [Symbol_observable]() {
    return this;
  }

  /**
   * @deprecated Should be only used for interop.
   */
   subscribe(observer?: PartialObserver<T>): CellSubscription<T>;
  /**
   * @deprecated Should be only used for interop.
   */
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): CellSubscription<T>;
  /**
   * @deprecated Should be only used for interop.
   */
  subscribe(
    next?: ((value: T) => void) | PartialObserver<T>,
    error?: (error: any) => void,
    complete?: () => void
  ): CellSubscription<T> {
    if (typeof next === 'function') {
      return new CellSubscription(this, {
        next,
        error,
        complete,
      });
    } else if (typeof next == 'object') {
      return new CellSubscription(this, next);
    }
    throw new TypeError('');
  }
}

class CellSubscription<T> implements Unsubscribable {
  private readonly reaction: Reaction;

  constructor(cell: Cell<T>, observer: PartialObserver<T>) {
    const callback = () => {
      let value ,
        isError = false;
      try {
        value = this.reaction.execute(() => cell.value);
      } catch (e: any) {
        value = e;
        isError = true;
      }
      if (isError) {
        observer.closed || observer.next?.(value);
      } else {
        observer.closed || observer.error?.(value);
      }
    };
    this.reaction = new Reaction(callback);
    callback();
  }

  unsubscribe() {
    this.reaction.dispose();
  }
}

export class Reaction {
  get stale() {
    return false;
  }

  private internal: _Reaction;

  constructor(callback: () => any) {
    this.internal = createReaction(callback);
  }

  execute<T>(expr: () => T) {
    return executeReaction<T>(this.internal, expr);
  }

  dispose() {
    cleanupComputation(this.internal);
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
        setData(internal, v as any);
      }
    },
  ];
}

export function mutValue<T>(initialValue: T): [Cell<T>, (value: T) => void] {
  const internal = createData(initialValue);
  return [
    new Cell(internal),
    (v) => {
      setData(internal, v as any);
    },
  ];
}

export function computed<T>(expr: () => T): Cell<T> {
  return new Cell(createMemo(expr));
}
