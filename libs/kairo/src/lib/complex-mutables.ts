import { createData, setData } from './core/behavior';
import { Behavior } from './public-api';
import { produce } from 'immer';

interface MutableArray<R> {
    setAt(index: number, value: R): void;
    push(...items: R[]): number;
    pop(): R | undefined;
    shift(): R | undefined;
    unshift(...items: R[]): number;
    splice(start: number, deleteCount?: number): R[];
    reverse(): R[];
}

export function mutableArray<R>(
    initial: Array<R>
): [Behavior<R[]>, MutableArray<R>] {
    const array = initial;
    const internal = createData(array);
    // array.
    return [
        new Behavior(internal),
        {
            setAt(index: number, value: R) {
                array[index] = value;
                setData(internal, array, false);
                return;
            },
            push(...items: R[]) {
                const ret = array.push(...items);
                setData(internal, array, false);
                return ret;
            },
            pop() {
                const ret = array.pop();
                setData(internal, array, false);
                return ret;
            },
            shift() {
                const ret = array.shift();
                setData(internal, array, false);
                return ret;
            },
            unshift(...items: R[]) {
                const ret = array.unshift(...items);
                setData(internal, array, false);
                return ret;
            },
            splice(start: number, deleteCount?: number) {
                const ret = array.splice(start, deleteCount);
                setData(internal, array, false);
                return ret;
            },
            reverse() {
                const ret = array.reverse();
                setData(internal, array, false);
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

export function mutableSet<T>(
    initial?: Iterable<T>
): [Behavior<Set<T>>, MutableSet<T>] {
    const set = new Set<T>(initial);
    const internal = createData(set);
    return [
        new Behavior(internal),
        {
            add(value: T) {
                set.add(value);
                setData(internal, set, false);
                return this;
            },
            delete(value: T) {
                const ret = set.delete(value);
                setData(internal, set, false);
                return ret;
            },
            clear() {
                set.clear();
                setData(internal, set, false);
            },
        },
    ];
}

export interface MutableMap<K, V> {
    set(key: K, value: V): this;
    delete(key: K): boolean;
    clear(): void;
}

export function mutableMap<K, V>(
    initial?: Iterable<[K, V]>
): [Behavior<Map<K, V>>, MutableMap<K, V>] {
    const map = new Map(initial ? [...initial] : []);
    const internal = createData(map);
    return [
        new Behavior(internal),
        {
            clear() {
                map.clear();
                setData(internal, map, false);
            },
            delete(key: K) {
                const ret = map.delete(key);
                setData(internal, map, false);
                return ret;
            },
            set(key: K, value: V) {
                map.set(key, value);
                setData(internal, map, false);
                return this;
            },
        },
    ];
}

export function immer<T extends object>(
    initialValue: T
): [Behavior<T>, (recipe: (current: T) => T) => void] {
    const internal = createData(initialValue);
    return [
        new Behavior(internal),
        (recipe: (draft: T) => T) =>
            setData(internal, produce(internal.value!, recipe), true),
    ];
}
