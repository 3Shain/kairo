import type { Node } from './reactivity';

interface Cell<T> {
  ():T;

}

interface CellOptions {
  is: (value1: any, value2: any) => boolean;
  name: string;
}

export function isCell(a: unknown): a is Cell<unknown> {
  return (
    typeof a === 'object' &&
    a !== null &&
    'flags' in a &&
    // @ts-expect-error
    typeof a.flags === 'number' &&
    // @ts-expect-error
    (a.flags & 0) === 0
  );
}

export let recently_computed_cache: Map<Node, { state: any; error: boolean }> =
  new Map();

export type {
  Cell,
  CellOptions
};
