import { callback } from "./utils";
import { ReadableChannel, Task } from "./types";
import { EventStream } from "../public-api";

const END = {};

class EventReader<T> implements ReadableChannel<T> {

    private closed = false

    private bufferQueue: any[] = [];

    private continuation: Function | null = null;

    private stopListening = this.from.listen((next) => {
        if (this.continuation) {
            this.continuation(next);
        } else {
            this.bufferQueue.push(next);
        }
    });
    constructor(
        private from: EventStream<T>,
        until: EventStream<any>
    ) {
        until.listenNext((next) => {
            // This listener is never unsubscribe manully?
            // potential mem leak?
            if (!this.closed) {
                this.closed = true;
                if (this.continuation) {
                    this.continuation(END);
                    this.continuation = null;
                }
                this.stopListening();
            }
        });
    }

    dispose() {
        if (!this.closed) {
            this.stopListening();
            this.closed = true;
        }
    }

    *next(): Task<T> {
        if (this.continuation) {
            throw new Error(`There exists a Task waiting for this channel already.`);
        }
        if (this.closed) {
            throw new Error(`Closed`); // TODO: catchable error
        }
        if (this.bufferQueue.length > 0) {
            return this.bufferQueue.shift();
        }
        return yield* callback((resolve, reject) => {
            const continuation = (value: T) => {
                if (value === END) {
                    reject(new Error(`Closed`) // TODO: catchable error
                    );
                    return;
                }
                this.continuation = null;
                resolve(value);
            };
            this.continuation = continuation;
            return () => {
                this.continuation = null;
            }
        });
    }

    *hasNext(): Task<boolean> {
        if (this.continuation) {
            throw new Error(`There exists a Task waiting for this channel already.`);
        }
        if (this.closed) {
            return false;
        }
        if (this.bufferQueue.length > 0) {
            return true;
        }
        return yield* callback<boolean>((resolve) => {
            const continuation = (value: unknown) => {
                if (value === END) {
                    this.continuation = null;
                    resolve(false)
                    return;
                }
                this.bufferQueue.push(value);
                this.continuation = null;
                resolve(true);
            };
            this.continuation = continuation;
            return () => {
                this.continuation = null;
            }
        });
    }
}

export function readEvents<TF, TU>(props: {
    from: EventStream<TF>,
    until: EventStream<TU>
}): ReadableChannel<TF> {
    return new EventReader(props.from, props.until);
    // TODO: auto dispose
}