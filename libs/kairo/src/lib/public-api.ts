import {
    createData,
    createComputation,
    setData,
    Data,
    Computation,
    accessComputation,
    accessData,
    untrack,
    watch,
    disposeWatcher,
    cleanupComputation,
    runInTransaction,
} from './core/behavior';
import { Scheduler } from './core/schedule';
import { registerDisposer, runIfScopeExist } from './core/scope';
import {
    createStream,
    Emitter,
    emitEvent,
    subscribe,
    unsubscribe,
    unsusbcribeNext,
    subscribeNext,
} from './core/stream';
import { TeardownLogic } from './types';

export function mutable<T>(initialValue: T): [Behavior<T>, (value: T) => void] {
    const internal = createData(initialValue);
    return [new Behavior(internal), (v) => setData(internal, v)];
}

export function computed<T>(expr: () => T, staticDependencies = false) {
    const internal = createComputation(expr, {
        static: staticDependencies,
    });
    runIfScopeExist(() => {
        registerDisposer(() => {
            cleanupComputation(internal, 0);
        });
    });
    return new ComputationalBehavior(internal);
}

export function stream<T>(): [EventStream<T>, (payload: T) => void] {
    const event = createStream();
    return [new EventStream(event), emitEvent.bind(event)];
}

export function isBehavior<T>(value: unknown): value is Behavior<T> {
    return value instanceof Behavior;
}

export function isEventStream<T>(value: unknown): value is EventStream<T> {
    return value instanceof EventStream;
}

export type ExtractBehaviorProperty<T> = T extends object
    ? {
          [P in keyof T]: T[P] extends Behavior<infer C> ? C : T[P];
      }
    : T;

export function combine<A extends Array<Behavior<any>>[]>(
    array: A
): Behavior<ExtractBehaviorProperty<A>>;
export function combine<
    C extends {
        [key: string]: Behavior<any>;
    }
>(obj: C): Behavior<ExtractBehaviorProperty<C>>;
export function combine(obj: object): Behavior<any> {
    if (obj instanceof Array) {
        /** Array need to be implemented in different way */
        return computed(() => {
            return obj.map((x) => {
                return x.value;
            });
        }, true);
    }
    return computed(() => {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => {
                return [key, value.value];
            })
        );
    }, true);
}

export function action<Fn extends (...args: any[]) => any>(
    fn: Fn
): (...args: Parameters<Fn>) => ReturnType<Fn> {
    const ret = (...args: any[]) => runInTransaction(() => fn(...args));
    // ret.name = fn.name;
    return ret;
}

type K<T> = {
    [P in keyof T]: T[P] extends EventStream<infer C> ? C : unknown;
};

type Union<T extends any[]> = T[number];

export function merge<A extends EventStream<any>[]>(
    array: A
): EventStream<Union<K<A>>> {
    const internal = createStream<Union<K<A>>>();
    const emitter = emitEvent.bind(internal as any);
    for (const event of array) {
        event.listen(emitter);
    }
    return new EventStream(internal);
}

export class Behavior<T = any> {
    constructor(protected internal: Data<T>) {}

    get value(): T {
        return accessData(this.internal);
    }

    map<R>(mapFn: (value: T) => R): Behavior<R> {
        const internal = createComputation(() => mapFn(this.value), {
            static: true,
            sources: [this.internal],
        });
        runIfScopeExist(() => {
            registerDisposer(() => {
                cleanupComputation(internal, 0);
            });
        });
        return new ComputationalBehavior(internal);
    }

    switch<R>(
        switchFn: (value: T) => Behavior<R> /* use output type? */
    ): Behavior<R> {
        const internal = createComputation(() => {
            const returned = untrack(switchFn, this.value);
            return returned.value;
        });
        runIfScopeExist(() => {
            registerDisposer(() => {
                cleanupComputation(internal, 0);
            });
        });
        return new ComputationalBehavior(internal);
    }

    changes(scheduler: Scheduler<T>): EventStream<T> {
        const internal = createStream<T>();
        const emitter = emitEvent.bind(internal as any);
        this.watch(emitter);
        return new EventStream(internal).schedule(scheduler);
    }

    watch(watchFn: (value: T) => void): TeardownLogic {
        const watcher = watch(this.internal, () => {
            watchFn(this.internal.value!);
        });
        // if inside a scope
        runIfScopeExist(() => {
            registerDisposer(() => disposeWatcher(watcher));
        });
        return () => disposeWatcher(watcher);
    }

    pipe() {
        throw Error('not implemented');
    }
}

export class ComputationalBehavior<T> extends Behavior<T> {
    constructor(internal: Computation<T>) {
        super(internal);
    }

    get value(): T {
        return accessComputation(this.internal as Computation);
    }
}

export class EventStream<Payload> {
    constructor(private internal: Emitter<Payload>) {}

    *[Symbol.iterator]() {
        const resoved = (yield this) as Payload;
        return resoved;
    }

    transform<R>(transformFn: (payload: Payload) => R) {
        const internal = createStream<R>();
        const emitter = emitEvent.bind(internal as any);
        this.listen((payload) => {
            emitter(transformFn(payload));
        });
        return new EventStream(internal);
    }

    filter(filterFn: (payload: Payload) => boolean) {
        const internal = createStream<Payload>();
        const emitter = emitEvent.bind(internal as any);
        this.listen((payload) => {
            if (filterFn(payload)) {
                emitter(payload);
            }
        });
        return new EventStream(internal);
    }

    schedule(scheduler: Scheduler<Payload>) {
        const internal = createStream<Payload>();
        const emitter = emitEvent.bind(internal as any);
        const next = scheduler(emitter);
        const disposor = {
            current: undefined,
        } as {
            current: Function | void;
        };
        this.listen((payload) => {
            disposor.current = next(payload);
        });
        // attach scope
        runIfScopeExist(() => {
            registerDisposer(() => {
                if (disposor.current) {
                    disposor.current();
                }
            });
        });
        return new EventStream(internal);
    }

    reduce<T>(reducer: (acc: T, cur: Payload) => any, initialValue: T) {
        const internal = createData(initialValue);
        this.listen((payload) => {
            setData(internal, reducer(internal.value!, payload));
        }); // solve gc itself!
        return new Behavior(internal);
    }

    hold(initialValue: Payload) {
        const internal = createData(initialValue);
        this.listen((p) => setData(internal, p));
        return new Behavior(internal);
    }

    listen(listener: (payload: Payload) => void): TeardownLogic {
        const subscriber = subscribe(this.internal, listener);
        // attach scope
        runIfScopeExist(() => {
            registerDisposer(() => unsubscribe(this.internal, subscriber));
        });
        return () => unsubscribe(this.internal, subscriber);
    }

    listenNext(listener: (payload: Payload) => void): TeardownLogic {
        const subscriber = subscribeNext(this.internal, listener);
        // attach scope
        runIfScopeExist(() => {
            registerDisposer(() => unsusbcribeNext(this.internal, subscriber));
        });
        return () => unsusbcribeNext(this.internal, subscriber);
    }

    pipe() {
        throw Error('not implemented');
    }
}

export {
    createScope,
    runIfScopeExist,
    scopedWith,
    unscoped,
    disposeScope,
    inject,
    provide,
    resumeScope,
    InjectToken,
} from './core/scope';
export type { Scope, Provider, Factory } from './core/scope';
export { runInTransaction as transaction } from './core/behavior';
export * from './core/schedule';
