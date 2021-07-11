import { mutArray, mutMap, mutSet } from './collections';

describe('cell/collections', () => {
  const noop = () => {};

  it('mutArray', () => {
    const [
      array,
      { push, pop, unshift, shift, reverse, setAt, splice },
    ] = mutArray([]);

    const dispose = array.watch(noop); // watch it to make propagation works

    const arrayLen = array.map((x) => x.length);
    const arrayMap = array.map((x) => x.map((y) => (y ? y * 2 : y)));

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

    dispose();
  });

  it('mutSet', () => {
    const [set, { add, delete: d, clear }] = mutSet([1,2,3]);

    const setSize = set.map(x=>x.size);
    
    add(4);
    expect(setSize.value).toBe(4);
    d(1);
    expect(setSize.value).toBe(3);
    clear();
    expect(setSize.value).toBe(0);
  });

  it('mutMap', () => {
    const [map, { set, delete: d, clear }] = mutMap<string,string>([["test","test"]]);

    const mapSize = map.map(x=>x.size);

    set("test2","test2");
    expect(mapSize.value).toBe(2);
    d("test");
    expect(mapSize.value).toBe(1);
    clear();
    expect(mapSize.value).toBe(0);
  });
});
