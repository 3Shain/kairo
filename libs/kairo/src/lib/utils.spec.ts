import { priorityQueue } from './utils';

describe("Utils function: ", () => {
    it("priorityQueue works as expected", () => {
        const queue = priorityQueue<number>((a, b) => a - b);
        queue.enqueue(6);
        queue.enqueue(5);
        queue.enqueue(1);
        queue.enqueue(3);
        queue.enqueue(9);
        expect(queue.dequeue()).toEqual(1);
        queue.enqueue(3);
        queue.enqueue(3);
        expect(queue.dequeue()).toEqual(3);
        expect(queue.dequeue()).toEqual(3);
        expect(queue.dequeue()).toEqual(3);
        expect(queue.dequeue()).toEqual(5);
        expect(queue.dequeue()).toEqual(6);
        expect(queue.dequeue()).toEqual(9);
    })
});