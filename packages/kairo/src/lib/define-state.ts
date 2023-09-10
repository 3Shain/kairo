import type { Cell, CellOptions } from './cell';
import { recently_computed_cache } from './cell';
import { Stateful } from './concern';
import {
  Node,
  __dev_next_prio,
  dirty,
  __implicit_tracking,
  FLAG_ERROR,
  FLAG_UPTODATE,
} from './reactivity';

type Setter<T> = {
  /**
   * perform a state mutation and propagate changes immediately
   */
  (value: T): void;
  /**
   * schedule a state mutation
   */
  defer(value: T): void;
};

function __get_value<T>(cell: Node<T>) {
  // assert cell.flags & FLAG_UPTODATE
  if (cell.flags & FLAG_ERROR) throw cell.state;
  return cell.state;
}

export function* State<T>(
  initial: T
): Generator<Stateful, [Cell<T>, Setter<T>]> {
  const cell = (yield {
    feature: 'state-allocation',
    hook: ()=>{
      return ()=>{

      }
    }
  }) as any;
  let state_closure = initial;
  const setter: Setter<T> = (value) => {
    state_closure = value;
    if (recently_computed_cache.size) {
      recently_computed_cache.clear();
    }
    dirty(cell);
    if (__DEV__) {
      // if(in defer), print a warning.
    }
  };
  setter.defer = (value) => {};
  return [cell, setter];
}

// export function defineState<T>(
//   initial: T,
//   options?: Partial<CellOptions>
// ): [Cell<T>, Setter<T>] {
//   let state_closure = initial;
//   const cell: Cell<T> & Node<T> = () => __implicit_tracking(cell,__get_value);
//   cell.noe = null;
//   // @ts-ignore
//   cell.attr = 0;
//   cell.flags = FLAG_UPTODATE;
//   cell.state = initial;
//   cell.last = null;
//   cell.vstk = [null!];
//   cell.expr = () => state_closure;
//   cell.is = Object.is;
//   if (options?.is && typeof options.is === 'function') cell.is = options.is;
//   if (__DEV__) {
//     cell.__dev_prio = __dev_next_prio();
//     if (options?.name) {
//       cell.__dev_name = options.name;
//     } else {
//       cell.__dev_name = cell.__dev_prio.join('-');
//     }
//   }
//   const setter: Setter<T> = (value) => {
//     state_closure = value;
//     if (recently_computed_cache.size) {
//       recently_computed_cache.clear();
//     }
//     dirty(cell);
//     if (__DEV__) {
//       // if(in defer), print a warning.
//     }
//   };
//   setter.defer = (value) => {};
//   return [cell, setter];
// }

/**
 * perform all deferred state mutations and propagate chagnes immediately
 */
export function flushDeferredChanges() {}

export function act<T>(fn: () => T): T {
  throw new Error('Oops');
}

export function action<TFn extends (...args: any[]) => any>(fn: TFn): TFn {
  return ((...args: any[]) => act(() => fn(...args))) as any;
}
