import {
    createScope,
    disposeScope,
    getCurrentScope,
    registerDisposer,
    scopedWith,
    unscoped,
} from '../core/scope';
import { action, EventStream } from '../public-api';
import { TeardownLogic } from '../types';
import { noop } from '../utils';
import { nextTick } from '../utils/next-tick';
import { Task } from './types';

export const executeTask = Symbol.for('executeTask');

export const DISPOSED = {};

export function taskExecutor(
    gen: Generator,
    onSuccess: Function,
    onFailure: Function
) {
    let currentDisposer: Function | null = null;
    let { scope } = createScope(() => {});

    let iter = gen[Symbol.iterator]();

    function execute(resumed: unknown, error: unknown) {
        let performed: IteratorResult<unknown>;
        try {
            performed = scopedWith(
                action(() => (error ? iter.throw(error) : iter.next(resumed))),
                scope
            );
        } catch (e) {
            if (e === DISPOSED) {
                // user doesn't handle this.
            } else {
                onFailure(e);
            }
            disposeScope(scope);
            return;
        }

        if (performed.done == true) {
            onSuccess(performed.value);
            disposeScope(scope);
            return;
        }
        const toHandle = performed.value;
        if (typeof toHandle !== 'object' || toHandle === null) {
            execute(
                undefined,
                new Error(
                    'Invalid object yielded. Are you missing an asterisk(*) after `yield`?'
                )
            );
        } else if (toHandle instanceof EventStream) {
            currentDisposer = toHandle.listenNext((payload) => {
                execute(payload, undefined);
            });
        } else if (executeTask in toHandle) {
            currentDisposer = scopedWith(
                () =>
                    (toHandle as any)[executeTask](
                        (value: unknown) => {
                            execute(value, undefined);
                        },
                        (error: unknown) => {
                            execute(undefined, error);
                        }
                    ),
                scope
            );
        } else {
            execute(
                undefined,
                new Error(
                    'Invalid object yielded. Are you missing an asterisk(*) after `yield`?'
                )
            );
        }
    }

    execute(undefined, undefined);

    return () => {
        execute(undefined, DISPOSED);
        currentDisposer?.();
    };
}

export function task<TaskFn extends (...args: any[]) => Generator>(
    taskFn: TaskFn
): (...params: Parameters<TaskFn>) => ReturnType<TaskFn> {
    const inScope = getCurrentScope();
    const fn = function (...args: unknown[]) {
        let initialized = false;
        let cancelDisposer: (() => void) | undefined;
        let resolveHandler: ((v: any) => void) | undefined;
        let rejectHandler: ((v: any) => void) | undefined;
        let settled = false;
        const disposor = taskExecutor(
            taskFn(...args),
            (v: any) => {
                if (initialized) {
                    cancelDisposer?.();
                } else {
                    initialized = true;
                }
                resolveHandler?.(v);
                settled = true;
            },
            (e: any) => {
                // TODO: try finally? make sure disposor is canceled?
                if (initialized) {
                    cancelDisposer?.();
                } else {
                    initialized = true;
                }
                settled = true;
                if (rejectHandler) {
                    rejectHandler(e);
                } else {
                    console.error(`Uncaught (in task)`, e);
                }
            }
        );
        // register disposor?
        if (!initialized) {
            if (inScope) {
                cancelDisposer = scopedWith(
                    () => registerDisposer(disposor),
                    inScope
                );
            }
            initialized = true;
        }
        return callback<any>(function (resolve: Function, reject: Function) {
            if (settled) {
                throw Error('not avaliable');
            } else {
                resolveHandler = resolve as any;
                rejectHandler = reject as any;
            }
            return disposor;
        }) as ReturnType<TaskFn>;
    };

    return action(fn);
}

export function lockedTask<TaskFn extends (...args: any[]) => Generator>(
    taskFn: TaskFn,
    options?: {
        maxConcurrency?: number;
        throwThanWait?: boolean;
    }
) {
    const semaphore = new Semaphore(options?.maxConcurrency ?? 1);
    return task(function* () {
        if (!semaphore.free()) {
            if (options?.throwThanWait) {
                throw Error('Task is unaccessable.');
            }
        }
        yield* semaphore.waitOne();
        const ret = yield* taskFn();
        semaphore.release();
        return ret;
    });
}

export function switchedTask<TaskFn extends (...args: any[]) => Generator>(
    taskFn: TaskFn,
    options?: {
        maxConcurrency: number;
    }
): (...params: Parameters<TaskFn>) => ReturnType<TaskFn> {
    const maxConcurrency = options?.maxConcurrency ?? 1;

    const disposeQueue: Function[] = [];

    const startTask = task(taskFn);

    return (...args) => {
        if (disposeQueue.length >= maxConcurrency) {
            disposeQueue.shift()!();
        }
        const ret = startTask(...args);
        disposeQueue.push(
            ret
                .next()
                .value[executeTask](noop, (e: unknown) =>
                    console.error(`Uncaught (in task)`, e)
                )
        ); // TODO: should remove from queue to avoid mem leak?
        return ret;
    };
}

export function* callback<T>(
    executor: (
        resolve: (value: T) => void,
        reject: (reason: any) => void
    ) => TeardownLogic | void
): Task<T> {
    return yield {
        [executeTask](resolve: any, reject: any) {
            let settled = false;
            let syncFlag = true;
            const dispose = executor(
                (v) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (syncFlag) {
                        nextTick(() => resolve(v)); // TODO: scheduler?
                    } else {
                        resolve(v);
                    }
                },
                (v) => {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (syncFlag) {
                        nextTick(() => reject(v)); //
                    } else {
                        reject(v);
                    }
                }
            );
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
        },
    };
}

export class Semaphore {
    private currentNum = 0;
    private queue: Function[] = [];

    constructor(private maxConcurrency: number) {}

    free() {
        return this.currentNum < this.maxConcurrency;
    }

    *waitOne(): Task<void> {
        if (this.currentNum >= this.maxConcurrency) {
            yield* callback((resolve) => {
                this.queue.push(resolve as any);
                return () => this.queue.splice(this.queue.indexOf(resolve), 1); // resolve definitely exist.
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
            this.queue.shift()!();
        }
    }
}
