import { noop } from '../misc';
import { Cell } from './cell';
import {
  createMemo,
  createData,
  setData,
  Data,
  batch,
  BitFlags,
} from './internal';

type Executor = (signal: AbortSignal) => Promise<any>;

export class CellSuspended {
  constructor(public readonly executor: Executor) {}
}

export type SuspendedCellOptions<T, F> = {
  fallback: F;
  initial: T;
  comparator: (a: T, b: T) => boolean;
};

const DEFER_SUSPENSION = new CellSuspended(
  /* istanbul ignore next: not used */ () => new Promise(noop)
);

type Track = <T>(cell: Cell<T>) => T;
type SuspendedTrack = <T>(cell: SuspendedCell<T, any>) => T;

export class SuspendedCell<T, F> extends Cell<T | F> {
  private _notifier: Data<number>;
  private _currentSuspension: CellSuspended | null = null;

  private _executing: AbortController | null = null;

  [Symbol.toStringTag] = 'SuspendedCell';

  private static strack<C>(
    t: <D>(data: Data<D>) => D,
    cell: SuspendedCell<C, any>
  ): C {
    const value = t(cell.internal);
    if (cell._currentSuspension !== null) {
      throw DEFER_SUSPENSION;
    }
    return value;
  }

  constructor(
    expr: (track: Track, read: SuspendedTrack) => T,
    options?: Partial<SuspendedCellOptions<T, F>>
  ) {
    super(
      createMemo(
        ($) => {
          try {
            $(this._notifier);
            const value = expr(track($), strack($));
            this._currentSuspension = null;
            return value;
          } catch (e) {
            if (e instanceof CellSuspended) {
              this._currentSuspension = e;
              //
              if ((this.internal.flags & BitFlags.Stale) === 0) {
                // estimate or propagate
                this.cancelLatest();
                this.forkCurrent(e);
              }
              return fallback;
            }
            throw e; // throw user-land error, or DEFER_COMPUTATION
          }
        },
        options?.comparator,
        options?.initial
      )
    );
    this._notifier = createData(0);
    const fallback = options?.fallback as any;
    const track =
      (t: <D>(data: Data<D>) => D) =>
      <C>(cell: Cell<C>) =>
        SuspendedCell.track(t, cell);
    const strack =
      (t: <D>(data: Data<D>) => D) =>
      <C>(cell: SuspendedCell<C, any>) =>
        SuspendedCell.strack(t, cell);
  }

  private cancelLatest() {
    if (this._executing !== null) {
      // cancel current?
      this._executing.abort();
      this._executing = null;
    }
  }

  private forkCurrent(s: CellSuspended) {
    if (s === DEFER_SUSPENSION) {
      return; // control by upstream
    }
    const cc = (this._executing = new AbortController());
    s.executor(cc.signal).finally(() => {
      if (this._executing !== cc) return; // not needed.
      this._executing = null;
      setData(this._notifier, this._notifier.value! + 1); // maybe schedule it?
    });
  }
}

export function suspended<T, F = undefined>(
  expr: ($: Track, read: SuspendedTrack) => T,
  options?: Partial<SuspendedCellOptions<T, F>>
) {
  return new SuspendedCell(expr, options);
}

// const queue: (() => void)[] = [];

// function enqueueJob(job: () => void) {
//   if (queue.length === 0) {
//     enqueueTask(() => {
//       batch(() => {
//         while (queue.length) {
//           queue.pop()!();
//         }
//       });
//     });
//   }
//   queue.push(job);
// }

// const enqueueTask = /* istanbul ignore next */ (
//   (() => {
//     if (typeof setImmediate === 'function') {
//       return setImmediate;
//     }
//     if (typeof MessageChannel !== 'undefined') {
//       const channel = new MessageChannel();
//       return (callback) => {
//         channel.port1.onmessage = callback;
//         channel.port2.postMessage(undefined);
//       };
//     } /* istanbul ignore next */
//     return (callback) => setTimeout(callback, 0);
//   }) as () => (callback: () => void) => void
// )();
