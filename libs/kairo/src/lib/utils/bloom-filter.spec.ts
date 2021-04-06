import { BloomFilter } from './bloom-filter';

describe('utils/bloom-filter', () => {
    it('should work', () => {
        const filter = new BloomFilter(8, 4);
        const a = 'Hello';
        const b = 'World';
        filter.add(a);
        expect(filter.test(a)).toBeTruthy();
        expect(filter.test(b)).toBeFalsy();
    })

    it('should inherit', () => {
        const filter = new BloomFilter(8, 4);
        const a = 'Hello';
        const b = 'World';
        const c = 'Bye';
        filter.add(a);
        expect(filter.test(a)).toBeTruthy();
        expect(filter.test(b)).toBeFalsy();

        const newFilter = new BloomFilter(8, 4, filter.buckets);
        newFilter.add(b);
        expect(newFilter.test(a)).toBeTruthy();
        expect(newFilter.test(b)).toBeTruthy();

        filter.add(c);
        expect(filter.test(c)).toBeTruthy();
        expect(newFilter.test(c)).toBeFalsy();

    })
})