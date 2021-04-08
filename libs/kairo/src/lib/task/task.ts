import { Task, TaskFunction } from './types';
import {
    createScope,
    disposeScope,
    registerDisposer,
    resumeScope,
    Scope,
    scopedWith,
} from '../core/scope';
import { action, EventStream } from '../public-api';
import { callback } from './utils';

let inside_runner = false;

export const executeTask = Symbol.for('executeTask');

export const DISPOSED = {};

/**
 *
 *
 * Dispose is always an idempotent action
 * dispose should not raise error!
 */

export function taskExecutor(
    gen: Generator,
    parentScope: Scope,
    onSuccess: Function,
    onFailure: Function
) {
    let currentDisposer: Function | null = null;
    let { scope } = createScope(() => {
        // noop
    }); // TODO: Parent might be not sealed?

    function execute(resumed: unknown, error: unknown) {
        let performed: IteratorResult<unknown>;
        try {
            /** there should be task context: to create a new zone which has inner event  */
            performed = scopedWith(
                // TODO: as well as transaction!
                () => (error ? gen.throw(error) : gen.next(resumed)),
                scope
            );
        } catch (e) {
            if (e === DISPOSED) {
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
        if (typeof toHandle !== 'object') {
            execute(undefined, Error('You should yield an object.'));
        } else if (toHandle === null) {
            execute(undefined, Error('null is yielded.'));
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
        }
    }

    execute(undefined, undefined);

    return () => {
        currentDisposer?.();
        execute(undefined, DISPOSED);
    };
}

export function task<TaskFn extends (...args: any[]) => Generator>(
    tasnFn: TaskFn
): (...params: Parameters<TaskFn>) => ReturnType<TaskFn> {
    // get current disposor?
    const scope = resumeScope();
    const fn = function (...args: unknown[]) {
        if (inside_runner) {
            // if inside a taskrunner? just return the wrapped task.
            // (but it's ok if raise a new runner ahaha)
            return tasnFn(...args);
        }
        // otherwise, initiate a new task runner and 'fire&forget'
        let initialized = false;
        let cancelDisposor: () => void;
        const disposor = taskExecutor(
            tasnFn(...args),
            scope,
            () => {
                // cleanup the disposor
                // it is a valid action (before scope is disposed)
                if (initialized) {
                    cancelDisposor(); //
                } else {
                    initialized = true;
                }
            },
            (e: any) => {
                const errorOutput = new Error(`Uncaught (in task) ${e}`);
                errorOutput.stack = e?.stack;
                console.error(errorOutput);
                // TODO: try finally? make sure disposor is canceled?
                if (initialized) {
                    // cancelDisposor();
                } else {
                    initialized = true;
                }
            }
        );
        // register disposor?
        if (!initialized) {
            cancelDisposor = scopedWith(
                () => registerDisposer(disposor),
                scope
            );
            initialized = true;
        }
    }; // make sure this is inside an action.

    return action(fn.bind(fn as any) as any);
}
