import { runInTransaction, Behavior } from './core/behavior';
import { EventStream } from './core/stream';

export function isBehavior<T>(value: unknown): value is Behavior<T> {
    return value instanceof Behavior;
}

export function isEventStream<T>(value: unknown): value is EventStream<T> {
    return value instanceof EventStream;
}

export function action<Fn extends (...args: any[]) => any>(
    fn: Fn
): (...args: Parameters<Fn>) => ReturnType<Fn> {
    const ret = (...args: any[]) => runInTransaction(() => fn(...args));
    // ret.name = fn.name;
    return ret;
}

export {
    Behavior,
    ComputationalBehavior,
    mutable,
    mutable as mut,
    constant,
    combined,
    computed,
    suspended,
    lazy,
    runInTransaction as transaction,
    untrack,
    __current_collecting
} from './core/behavior';
export type { ExtractBehaviorProperty } from './core/behavior';
export { EventStream, stream, never, merged } from './core/stream';
export { inject, provide, effect, Scope, Token } from './core/scope';
export type { Provider, Factory } from './core/scope';
export { held, reduced } from './derived';
export * from './read';
export * from './core/schedule';
export * from './complex-mutables';
