import { Cell } from './cell';
import {
  accessValue,
  createMemo,
  createData,
  setData,
  batch,
  BitFlags,
  __current_transaction,
} from './internal';

export class SuspendedCell<T, F> extends Cell<T | F> {
  private isSuspending = false;

  constructor(expr: () => T, fallback: F) {
    super(
      createMemo(() => {
        try {
          accessValue(notifier);
          this.isSuspending = true;
          const value = expr();
          this.isSuspending = false;
          return value;
        } catch (e) {
          if (DEFER_SUSPENSION === e) {
            return fallback;
          }
          if (e instanceof Promise) {
            e.then(
              () => {
                if (e !== awaiting) {
                  return;
                }
                awaiting = null;
                enqueueJob(() => {
                  setData(notifier, notifier.value! + 1);
                });
              },
              (error) => {
                if (e !== awaiting) {
                  return;
                }
                awaiting = null;
                enqueueJob(() => {
                  // it's definitely in a transaction
                  this.internal.flags |= BitFlags.HasError | BitFlags.Changed;
                  this.internal.value = error;
                  __current_transaction()!.addDirty(this.internal);
                });
              }
            );
            awaiting = e;
            return fallback;
          }
          this.isSuspending = false; // throw user-land error, or DEFER_COMPUTATION
          throw e;
        }
      })
    );
    let awaiting: Promise<any> | null = null;
    const notifier = createData(0);
  }

  read(): T {
    const value = this.value; // log access
    if (this.isSuspending) {
      throw DEFER_SUSPENSION;
    }
    return value as T;
  }
}

export function suspended<T, F = undefined>(expr: () => T, fallback?: F) {
  return new SuspendedCell(expr, fallback);
}

const DEFER_SUSPENSION = {
  toString: /* istanbul ignore next */  () => '[Cell SUSPENDING]',
};

const queue: (() => void)[] = [];

function enqueueJob(job: () => void) {
  if (queue.length === 0) {
    enqueueTask(() => {
      batch(() => {
        while (queue.length) {
          queue.pop()!();
        }
      });
    });
  }
  queue.push(job);
}

const enqueueTask = ((() => {
  if (typeof setImmediate === 'function') {
    return setImmediate;
  } /* istanbul ignore next */
  if (typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel();
    return (callback) => {
      channel.port1.onmessage = callback;
      channel.port2.postMessage(undefined);
    };
  } /* istanbul ignore next */
  return (callback) => setTimeout(callback, 0);
}) as () => (callback: () => void) => void)();
