import { mutableArray } from './complex-mutables';

describe('complex-mutables', () => {
    const noop = () => {};

    it('mutableArray', () => {
        const [
            array,
            { push, pop, unshift, shift, reverse, setAt, splice },
        ] = mutableArray([]);

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

    // TODO: complete unit tests
});
