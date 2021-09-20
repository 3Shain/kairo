import { mutArray, mutMap, mutSet } from './collections';
import { cleanup, effect } from './cell.spec';
import { computed } from './cell';

describe('cell/collections', () => {

  it('mutArray', () => {
    const [
      array,
      { push, pop, unshift, shift, reverse, setAt, splice },
    ] = mutArray([]);

    effect(() => array.value);

    const arrayLen = computed(() => array.value.length);
    const arrayMap = computed(() => array.value.map((y) => (y ? y * 2 : y)));

    push(1, 2, 3);
    expect(arrayLen.value).toEqual(3);
    pop();
    expect(arrayLen.value).toEqual(2);
    shift();
    expect(arrayLen.value).toEqual(1);
    unshift(1);
    expect(arrayLen.value).toEqual(2);
    reverse();
    expect(arrayLen.value).toEqual(2);
    expect(array.value).toEqual([2, 1]);
    expect(arrayMap.value).toEqual([4, 2]);
    splice(0, 1);
    expect(arrayLen.value).toEqual(1);
    expect(array.value).toEqual([1]);
    setAt(10, 3); // make holy array
    expect(arrayLen.value).toBe(11);
  });

  it('mutSet', () => {
    const [set, { add, delete: d, clear }] = mutSet([1, 2, 3]);

    const setSize = computed(() => set.value.size);

    add(4);
    expect(setSize.value).toBe(4);
    d(1);
    expect(setSize.value).toBe(3);
    clear();
    expect(setSize.value).toBe(0);
  });

  it('mutMap', () => {
    const [map, { set, delete: d, clear }] = mutMap<string, string>([
      ['test', 'test'],
    ]);

    const mapSize = computed(() => map.value.size);

    set('test2', 'test2');
    expect(mapSize.value).toBe(2);
    d('test');
    expect(mapSize.value).toBe(1);
    clear();
    expect(mapSize.value).toBe(0);
  });

  afterEach(cleanup);
});
