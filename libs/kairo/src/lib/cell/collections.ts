import { createData, setData } from './internal';
import { Cell } from './cell';

export interface MutableArray<R> {
  length: number;
  setAt(index: number, value: R): void;
  push(...items: R[]): number;
  pop(): R | undefined;
  shift(): R | undefined;
  unshift(...items: R[]): number;
  splice(start: number, deleteCount?: number): R[];
  reverse(): R[];
}

export function mutArray<R>(initial: Array<R>): [Cell<R[]>, MutableArray<R>] {
  let array = initial;
  const internal = createData(array);
  return [
    new Cell(internal),
    {
      set length(value: number) {
        array = Array.from(array);
        array.length = value;
        setData(internal, array);
        return;
      },
      get length() {
        return array.length;
      },
      setAt(index: number, value: R) {
        array[index] = value;
        setData(internal, array);
        return;
      },
      push(...items: R[]) {
        const ret = array.push(...items);
        setData(internal, array);
        return ret;
      },
      pop() {
        const ret = array.pop();
        setData(internal, array);
        return ret;
      },
      shift() {
        const ret = array.shift();
        setData(internal, array);
        return ret;
      },
      unshift(...items: R[]) {
        const ret = array.unshift(...items);
        setData(internal, array);
        return ret;
      },
      splice(start: number, deleteCount?: number) {
        const ret = array.splice(start, deleteCount);
        setData(internal, array);
        return ret;
      },
      reverse() {
        const ret = array.reverse();
        setData(internal, array);
        return ret;
      },
    },
  ];
}

export interface MutableSet<T> {
  add(value: T): MutableSet<T>;
  delete(value: T): boolean;
  clear(): void;
}

export function mutSet<T>(
  initial?: Iterable<T>
): [Cell<Set<T>>, MutableSet<T>] {
  let set = new Set<T>(initial);
  const internal = createData(set);
  return [
    new Cell(internal),
    {
      add(value: T) {
        set = new Set(set);
        set.add(value);
        setData(internal, set);
        return this;
      },
      delete(value: T) {
        set = new Set(set);
        const ret = set.delete(value);
        setData(internal, set);
        return ret;
      },
      clear() {
        set = new Set();
        setData(internal, set);
      },
    },
  ];
}

export interface MutableMap<K, V> {
  set(key: K, value: V): this;
  delete(key: K): boolean;
  clear(): void;
}

export function mutMap<K, V>(
  initial?: Iterable<[K, V]>
): [Cell<Map<K, V>>, MutableMap<K, V>] {
  let map = new Map(initial ? [...initial] : []);
  const internal = createData(map);
  return [
    new Cell(internal),
    {
      clear() {
        map = new Map();
        setData(internal, map);
      },
      delete(key: K) {
        map = new Map(map);
        const ret = map.delete(key);
        setData(internal, map);
        return ret;
      },
      set(key: K, value: V) {
        map = new Map(map);
        map.set(key, value);
        setData(internal, map);
        return this;
      },
    },
  ];
}
