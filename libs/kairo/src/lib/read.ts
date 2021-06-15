import {
  accessData,
  createData,
  setData,
  Suspend,
  SuspendWithFallback,
  untrack,
} from './cell';
import { Runnable } from './task';
import { executeRunnable } from './task/task';
import { noop } from './utils';

export function read<T>(runnable: Runnable<T>): T {
  const data = createData(0);
  accessData(data); // log read.
  try {
    let sync = true;
    const disposer = untrack(() =>
      executeRunnable(
        runnable,
        (value) => {
          if (sync) {
            throw {
              $$RESOLVE: true,
              $$VALUE: value,
            };
          }
          // notify change!
          setData(data, 0, false);
        },
        (error) => {
          if (sync) {
            throw {
              $$REJECT: true,
              $$VALUE: error,
            };
          }
          // notify change!
          setData(data, 0, false);
        }
      )
    );
    sync = false;
    throw new Suspend(disposer);
  } catch (e) {
    if (e.$$RESOLVE === true) {
      return e.$$VALUE;
    } else if (e.$$REJECT === true) {
      throw e.$$VALUE;
    } else {
      throw e; // not likely to happen.
    }
  }
}

export function tryRead<T>(
  runnable: Runnable<T>,
  fallback: any,
  onError: (error: any) => any
) {
  try {
    return read(runnable);
  } catch (e) {
    if (e instanceof Suspend) {
      throw new SuspendWithFallback(fallback, e.cancel);
    } else {
      throw new SuspendWithFallback(onError(e), noop);
    }
  }
}
