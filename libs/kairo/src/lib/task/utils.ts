
import { resumeScope } from "../core/scope";
import { TeardownLogic } from "../types";
import { nextTick } from "../utils/next-tick";
import { executeTask, taskExecutor } from "./task";
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
                    nextTick(() => resolve(v)) // TODO: scheduler?
                } else {
                    resolve(v);
                }
            }, (v) => {
                if (settled) {
                    return;
                }
                settled = true;
                if (syncFlag) {
                    nextTick(() => reject(v)); // 
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

type ResolveAll<T> = {
    [P in keyof T]: T[P] extends Task<infer D> ? D : unknown
}

type Union<T extends any[]> = T[number];

function* any<R extends Array<Task<any>>>(
    array: R
): Task<Union<ResolveAll<R>>> {
    return yield* callback((resolve, reject) => {
        let taskNum = array.length;
        const disposors = array.map(task => taskExecutor(task, resumeScope(),
            (v: unknown) => {
                resolve(v as any);
                // should dispose other ?
            },
            () => {
                taskNum--;
                if (taskNum === 0) {
                    reject(Error('All task failed'));
                }
            }));
        return () => disposors.forEach(x => x());
    })
}

function* race<R extends Array<Task<any>>>(
    array: R
): Task<Union<ResolveAll<R>>> {
    return yield* callback((resolve, reject) => {
        const disposors = array.map(task => taskExecutor(task, resumeScope(),
            (v: unknown) => {
                resolve(v as any);
                // should dispose other ?
            },
            (e: unknown) => {
                reject(e);
                // should dispose other ?
            }));
        return () => disposors.forEach(x => x());
    })
}

function* all<R extends Array<any>>(
    array: R
): Task<ResolveAll<R>> {
    return yield* callback((resolve, reject) => {
        let remains = array.length;
        let result = new Array(remains);
        const disposors = array.map((task, index) => taskExecutor(task, resumeScope(),
            (v: unknown) => {
                result[index] = v;
                remains--;
                if (remains === 0) {
                    resolve(result as any);
                }
            },
            (e: unknown) => {
                reject(e);
                // should dispose other?
            }));
        return () => disposors.forEach(x => x());
    });
}

type ResolveAllSettled<T> = {
    [P in keyof T]: T[P] extends Task<infer D> ? {
        success: true,
        value: D
    } | {
        success: false,
        value: any
    } : unknown
}

function* allSettled<R extends Array<any>>(
    array: R
): Task<ResolveAllSettled<R>> {
    return yield* callback((resolve, reject) => {
        let remains = array.length;
        let result = new Array(remains);
        const disposors = array.map((task, index) => taskExecutor(task, resumeScope(),
            (v: unknown) => {
                result[index] = {
                    success: true,
                    value: v
                };
                remains--;
                if (remains === 0) {
                    resolve(result as any);
                }
            },
            (e: unknown) => {
                result[index] = {
                    success: false,
                    value: e
                };
                remains--;
                if (remains === 0) {
                    reject(Error('All task failed.'));
                }
            }));
        return () => disposors.forEach(x => x());
    });
}


export {
    delay,
    nextFrame,
    callback,
    resolve,
    all,
    allSettled,
    any,
    race
}