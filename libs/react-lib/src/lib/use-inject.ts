import {
    action,
    ExtractBehaviorProperty,
    Factory,
    inject,
    isBehavior,
    Token,
    Behavior,
    Scope,
    effect,
} from 'kairo';
import { useContext, useEffect, useMemo, useState } from 'react';
import { KairoContext } from './context';

export function useInject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: Token<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: Token<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? C : ExtractBehaviorProperty<T>;
export function useInject(
    token: any,
    options: any
): ExtractBehaviorProperty<any> {
    const parentScope = useContext(KairoContext);
    const [, setTick] = useState(0);
    const [exported, kairoScope] = useMemo(() => {
        const scope = new Scope(parentScope);
        const endScope = scope.beginScope();
        let tick = 0;
        let ref = {
            current: null,
        };
        const resolve = inject(token, options);
        if (typeof resolve !== 'object' || resolve === null) {
            ref.current = resolve;
            endScope();
            return [ref, scope];
        }
        if (isBehavior(resolve)) {
            effect(() =>
                resolve.watch((current) => {
                    ref.current = current;
                    setTick(++tick);
                })
            ); // watch future updates
            endScope();
            return [ref, scope];
        }
        let expose = {};
        for (const [key, value] of Object.entries(resolve)) {
            if (typeof value === 'function') {
                expose[key] = action(value);
            } else if (isBehavior(value)) {
                expose[key] = value.value;
                effect(() =>
                    value.watch((updated) => {
                        expose = {
                            ...expose,
                            [key]: updated,
                        }; // need to construct a new object, otherwise react will ignore as object reference not changed.
                        ref.current = expose;
                        setTick(++tick);
                    })
                );
            } else {
                expose[key] = value;
            }
        }
        ref.current = expose;
        endScope();
        return [ref, scope];
    }, []);

    useEffect(() => {
        return kairoScope.attach();
    }, []);

    return exported.current;
}
