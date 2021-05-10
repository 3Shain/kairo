import { Runnable } from './types';

export class CanceledError extends Error {
    name = 'CanceledError';
    constructor(message?: string) {
        super(message ?? 'Operation has been canceled');
    }
}

export interface CancellablePromiseLike<T> extends PromiseLike<T> {
    cancel(): void;
}

let $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER: any = null;

export class CancellablePromise<T> extends Promise<T> implements Runnable<T> {
    public readonly cancel: () => void;

    constructor(
        executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void
        ) => (() => void) | undefined
    ) {
        super((resolve, reject) => {
            let settled = false;
            // disposer is guaranteed to be not executed after: 1.fulfilled 2.rejected 3.disposed once(which is also reject)
            // resolve in dispose? I think it's valid. And default behavior is reject after disposer executed, but user
            // can reject/resolve in disposer and default behavior is ignored.
            let dispose = executor(
                (v) => {
                    resolve(v);
                    settled = true;
                },
                (e) => {
                    reject(e);
                    settled = true;
                }
            );
            $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER = () => {
                if (settled) {
                    return;
                }
                if (dispose) {
                    dispose(); // might become settled.
                    settled = true;
                    reject(new CanceledError());
                }
            };
        });
        this.cancel = $$CANT_ACCESS_CHILD_PROP_INSIDE_SUPER;
    }

    *[Symbol.iterator]() {
        return (yield this) as T;
    }

    /**
     * Why CancellablePromise.then returns Promise but not CancellablePromise?
     *
     * Because Promise stands for deferred value. To cancel a value doesn't make sense, but
     * to cancel the side effect to get a value is.
     * Because it's `a value` so you can `.then` a Promise as many times as you want.
     * And the side effect only executes onece.
     * Now if a derived `Promise` is canceled, then should the `source` be canceled as well?
     * The answer is no. Otherwise the semantic of `deferred value` is broken.
     * To not invalidate the semantic, a possible solution is `don't care if canceled`
     *
     * But that's not desired behavior as we actually want to cancel the side effect (ajax request/
     * multi-staged async process).
     *
     * Things got complex...
     *
     * So read Promise as deferred value. Then CancellablePromise is a Promise thus a deferred value as well.
     * Don't read Promise as a process to retrieve some values.
     * CancellablePromise provides the ability to manage side effects.
     */
}
