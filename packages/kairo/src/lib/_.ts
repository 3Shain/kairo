import type { ExpressionOf, Node } from './reactivity';
import { ATTR_PURE, __dev_next_prio, __implicit_tracking } from './reactivity';
import type { Cell, CellOptions } from './cell';
import { recently_computed_cache } from './cell';

function __get_value<T>(cell: Node<T>) {
  const a = recently_computed_cache.get(cell);
  if (a) {
    if (a.error) throw a.state;
    return a.state;
  }
  try {
    const state = cell.expr(__get_value);
    recently_computed_cache.set(cell, { error: false, state });
    return state;
  } catch (state) {
    recently_computed_cache.set(cell, { error: true, state });
    throw state;
  }
}

export function _<T>(
  expr: ExpressionOf<T>,
  options?: Partial<CellOptions>
): Cell<T> {
  const cell: Cell<T> & Node<T> = () => __implicit_tracking(cell, __get_value);
  cell.noe = null;
  // @ts-ignore
  cell.attr = ATTR_PURE;
  cell.flags = 0;
  cell.state = null!;
  cell.last = null;
  cell.vstk = [null!];
  cell.expr = expr;
  cell.is = Object.is;
  if (options?.is && typeof options.is === 'function') cell.is = options.is;
  if (__DEV__) {
    cell.__dev_prio = __dev_next_prio();
    if (options?.name) {
      cell.__dev_name = options.name;
    } else {
      cell.__dev_name = cell.__dev_prio.join('-');
    }
  }
  return cell as Cell<T>;
}
