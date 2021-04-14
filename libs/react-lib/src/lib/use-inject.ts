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
    runIfScopeExist(() => {
        throw Error('Use `inject` instead of `useInject` if inside a scope.');
    });
    const parentScope = useContext(KairoContext);
    const [expose, setExpose] = useState(undefined);

    useEffect(() => {
        if(parentScope.disposed){
            return;
        }
        const { scope } = createScope(() => {
            let expose = {};
            const resolve = inject(token, options);
            if (typeof resolve !== 'object' || resolve === null) {
                expose = resolve;
                return;
            }
            if (isBehavior(resolve)) {
                expose = resolve.value;
                resolve.watch((updated) => {
                    expose = updated;
                    setExpose(expose);
                });
                return;
            }
            for (const [key, value] of Object.entries(resolve)) {
                if (typeof value === 'function') {
                    expose[key] = action(value);
                } else if (isBehavior(value)) {
                    expose[key] = value.value;
                    value.watch((updated) => {
                        expose[key] = updated;
                        setExpose(expose);
                    });
                } else {
                    expose[key] = value;
                }
            }
            setExpose(expose);
        }, parentScope);
        return () => disposeScope(scope);
    }, [parentScope]);

    return expose;
}
