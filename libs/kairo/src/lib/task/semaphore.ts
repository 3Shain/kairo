import { callback } from "./utils";
import { Task } from "./types";

export class Semaphore {

    private currentNum = 0;
    private queue: (() => any)[] = [];

    constructor(
        private maxConcurrency: number
    ) { }

    *waitOne(): Task<void> {
        if (this.currentNum >= this.maxConcurrency) {
            yield* callback((resolve) => {
                this.queue.push(resolve as any);
            });
            // a free space is gurantted.
        }
        this.currentNum++;
        return;
    }

    // this is an action
    release() {
        this.currentNum--;
        // trigger?
        if (this.queue.length) {
            (this.queue.shift()!)();
        }
    }
}