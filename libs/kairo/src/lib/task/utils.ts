
import { TeardownLogic } from "../types";
import { executeTask } from "./task";
import { InteropObservable, Task } from "./types";

const observableSymbol = Symbol.observable ?? '@@observable';

function* callback<T>(
    executor: (
        resolve: (value: T) => void,
        reject: (reason: any) => void
    ) => TeardownLogic | void
): Task<T> {
    return yield {
        [executeTask](resolve: any, reject: any) {
            let settled = false;
            let syncFlag = true;
            const dispose = executor((v) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (syncFlag) {
                    queueMicrotask(() => resolve(v)) // TODO: scheduler?
                } else {
                    resolve(v);
                }
            }, (v) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (syncFlag) {
                    queueMicrotask(() => reject(v)); // 
                } else {
                    reject(v);
                }
            });
            syncFlag = false;
            return () => {
                if (settled) {
                    return;
                }
                settled = true;
                if (typeof dispose === 'function') {
                    dispose();
                }
            };
        }
    }
}

function* delay(time: number): Task<void> {
    return yield* callback((s) => {
        const id = setTimeout(s, time);
        return () => clearTimeout(id);
    });
}

function* nextFrame(): Task<number> {
    return yield* callback((s) => {
        const id = requestAnimationFrame(s);
        return () => cancelAnimationFrame(id);
    })
}


function resolve<T>(thenable: PromiseLike<T>): Task<T>
function resolve<T>(observable: InteropObservable<T>): Task<T>
function resolve<T>(value: T): Task<T>
function* resolve(obj: unknown): Task<unknown> {
    if (typeof obj === 'object' && obj !== null) {
        if ('then' in obj) {
            return yield* callback((resolve, reject) => {
                (obj as PromiseLike<unknown>).then(resolve, reject);
            });
        } else if (observableSymbol in obj) {
            return yield* callback((resolve, reject) => {
                let lastEmit: unknown = undefined;
                (obj as any)[observableSymbol]().subscribe(
                    (next: unknown) => { lastEmit = next; },
                    (error: unknown) => reject(error),
                    () => { resolve(lastEmit) }
                );
            });
        } else {
            return yield* callback((resolve) => {
                resolve(obj);
            });
        }
    } else {
        return yield* callback((resolve) => {
            resolve(obj);
        });
    }
}

function any(
    ...args: (Promise<unknown> | Task<unknown>)[]
) {

}

function all(
    ...args: (Promise<unknown> | Task<unknown>)[]
) {
}

function race(
    ...args: (Promise<unknown> | Task<unknown>)[]
) {

}

export {
    delay,
    nextFrame,
    callback,
    resolve
}