import {
    action,
    createScope,
    disposeScope,
    ExtractBehaviorProperty,
    Factory,
    inject,
    isBehavior,
    Scope,
    InjectToken,
    Behavior,
    runIfScopeExist,
} from 'kairo';
import { useContext, useEffect, useRef, useState } from 'react';
import { KairoContext } from './context';

export function useInject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject(
    token: any,
    options: any
): ExtractBehaviorProperty<any> {
    const expose = useRef({});
    const currentScope = useRef<Scope>();
    const parentScope = useContext(KairoContext);
    const [tick, setTick] = useState(0);
    const currentTick = useRef(0);
    currentTick.current = tick;
    if (currentScope.current === undefined) {
        runIfScopeExist(() => {
            throw Error('Use `inject` instead of `useInject` if inside a scope.');
        });
        const { scope } = createScope(() => {
            const resolve = inject(token, options);
            if (typeof resolve !== 'object' || resolve === null) {
                expose.current = resolve;
                return;
            }
            if (isBehavior(resolve)) {
                expose.current = resolve.value;
                resolve.watch((updated) => {
                    expose.current = updated;
                    setTick(currentTick.current + 1);
                });
                return;
            }
            for (const [key, value] of Object.entries(resolve)) {
                if (typeof value === 'function') {
                    expose.current[key] = action(value);
                } else if (isBehavior(value)) {
                    expose.current[key] = value.value;
                    value.watch((updated) => {
                        expose.current[key] = updated;
                        setTick(currentTick.current + 1); // it might be invoked multiple time in a transaction, react should handle this.
                    });
                } else {
                    expose.current[key] = value;
                }
            }
        }, parentScope);
        currentScope.current = scope;
    }

    useEffect(() => {
        return () => disposeScope(currentScope.current);
    }, []);

    return expose.current;
}
