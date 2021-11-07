/* istanbul ignore file: for test only */

import { Cell, Reaction } from './cell';
import { BitFlags, Memo } from './internal';

const toCleanup: Function[] = [];

export function cleanup() {
  toCleanup.forEach((x) => x());
  toCleanup.length = 0;
}

export function effect(fn: ($: Function) => any) {
  const callback = () => {
    r.track(fn);
  };
  const r = new Reaction(callback);
  callback();
  toCleanup.push(() => r.dispose());
  return () => r.dispose();
}

export function controlledEffect(fn: () => any) {
  const callback = () => {
    r.track(fn);
  };
  const r = new Reaction(callback);
  callback();
  return () => r.dispose();
}

export function countObservers(cell: Cell<any>) {
  let count = 0,
    lo = cell['internal'].lo;
  while (lo) {
    count++;
    lo = lo.prev;
  }
  return count;
}

export function countSources(cell: Cell<any> | Reaction) {
  let count = 0,
    lo = (cell['internal'] as Memo).ls;
  while (lo) {
    count++;
    lo = lo.prev;
  }
  return count;
}

export function hasFlag(cell: Cell<any>, flag: BitFlags) {
  return cell['internal'].flags & flag;
}

export function internalValue(cell: Cell<any>) {
  return cell['internal'].value;
}
