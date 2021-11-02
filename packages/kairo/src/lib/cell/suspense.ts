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

export type SuspendedCellOptions<T, F> = {
  fallback: F;
  comparator: (a: T, b: T) => boolean;
  keepPrevious: boolean;
};

export class SuspendedCell<T, F> extends Cell<T | F> {
  private isSuspending = false;


  static read<T, F>(cell: SuspendedCell<T, F>): T {
    const value = accessValue(cell.internal, true);
    if (cell.isSuspending) {
      throw DEFER_SUSPENSION;
    }
    return value as T;
  }

  [Symbol.toStringTag] = 'SuspendedCell';

  constructor(expr: () => T, options?: Partial<SuspendedCellOptions<T, F>>) {
    super(
      createMemo(() => {
        try {
          accessValue(notifier, true);
          this.isSuspending = true;
          const value = expr();
          this.isSuspending = false;
          return value;
        } catch (e) {
          if (DEFER_SUSPENSION === e) {
            return keepPrevious ? this.internal.value : fallback;
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
            return keepPrevious ? this.internal.value : fallback;
          }
          this.isSuspending = false; // throw user-land error, or DEFER_COMPUTATION
          throw e;
        }
      }, options?.comparator)
    );
    let awaiting: Promise<any> | null = null;
    const notifier = createData(0);
    const fallback = options?.fallback as any;
    const keepPrevious = options?.keepPrevious === true;
  }
}

(Cell.track as any).read = SuspendedCell.read;

type SuspendedTrack = typeof Cell.track & { read: typeof SuspendedCell.read };

export function suspended<T, F = undefined>(
  expr: ($: SuspendedTrack) => T,
  options?: Partial<SuspendedCellOptions<T, F>>
) {
  return new SuspendedCell(() => expr(Cell.track as any), options);
}

const DEFER_SUSPENSION = {
  [Symbol.toStringTag]: 'DeferSuspension',
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

const enqueueTask =  (
  (/* istanbul ignore next */ () => {
    if (typeof setImmediate === 'function') {
      return setImmediate;
    }
    if (typeof MessageChannel !== 'undefined') {
      const channel = new MessageChannel();
      return (callback) => {
        channel.port1.onmessage = callback;
        channel.port2.postMessage(undefined);
      };
    } /* istanbul ignore next */
    return (callback) => setTimeout(callback, 0);
  }) as () => (callback: () => void) => void
)();
