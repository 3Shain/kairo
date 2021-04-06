

export class ObjectDisposedError extends Error {

}

export function swapAt(arr: Array<unknown>, index1: number, index2: number) {
    const tmp = arr[index1];
    arr[index1] = arr[index2];
    arr[index2] = tmp;
}

export function priorityQueue<T>(
    compare: (a: T, b: T) => number
) {
    const bheap = [] as T[];
    let bheaplen = 0;

    return {
        enqueue: (value: T) => {
            bheap.push(value);
            /** binaryheap: go up */
            let cursor = bheaplen;
            bheaplen++;
            while (cursor > 0) {
                const parent = (cursor - 1) >> 1;
                if (compare(bheap[parent], bheap[cursor]) > 0) {
                    swapAt(bheap, parent, cursor);
                    cursor = parent;
                } else {
                    break; //already balanced
                }
            }
        },
        dequeue: () => {
            const ret = bheap[0];
            bheaplen--;
            bheap[0] = bheap[bheaplen];
            bheap[bheaplen] = ret;
            bheap.pop();
            /** binaryheap: go down */
            let cursor = 0;
            while (cursor * 2 + 1 < bheaplen) { //if curosr*2 >= bheaplen, we have no children to compare
                const left = cursor * 2 + 1;
                const right = cursor * 2 + 2;
                // if right == bheap:  left is the last entry, there is no right child
                const target = right == bheaplen ? left : compare(bheap[left], bheap[right]) > 0 ? right : left;
                if (compare(bheap[cursor], bheap[target]) > 0) {
                    swapAt(bheap, cursor, target);
                    cursor = target;
                } else {
                    break;
                }
            }
            return ret;
        },
        size: () => bheaplen
    }
}

export const noop = () => { };
