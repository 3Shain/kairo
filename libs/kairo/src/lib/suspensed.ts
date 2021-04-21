import { createSuspensed } from './core/behavior';
import { ComputationalBehavior } from './public-api';

// function suspensed<T, G, ReadFn extends (...args: any[]) => Promise<G>, F>(
//     fn: (read: <P>(reader: ReadFn, ...args: Parameters<ReadFn>) => G) => T,
//     fallback?: F
// ): any;
function suspensed<T, F = undefined>(
    fn: (
        read: <ReadFn extends (...args: any[]) => Promise<any>>(
            reader: ReadFn,
            ...args: Parameters<ReadFn>
        ) => ReturnType<ReadFn> extends Promise<infer G> ? G : unknown
    ) => T,
    fallback?: F
) {
    return new SuspensedBehavior<T, F>(fn as any, fallback as any); // TODO: type settings...
}

class SuspensedBehavior<T, F> extends ComputationalBehavior<T | F> {
    constructor(fn: (read: Function) => T, fallback: F) {
        super(createSuspensed(fn, fallback));
    }

    get error(): object | undefined {
        return undefined;
    }

    get value(): T|F{
        return super.value;
    }
}

export { suspensed };