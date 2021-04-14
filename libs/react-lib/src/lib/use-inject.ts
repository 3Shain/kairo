import {
    action,
    createScope,
    disposeScope,
    ExtractBehaviorProperty,
    Factory,
    inject,
    isBehavior,
    InjectToken,
    Behavior,
    scopedWith,
} from 'kairo';
import { useContext, useEffect, useState } from 'react';
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
    const parentScope = useContext(KairoContext);
    const [expose, setExpose] = useState(() =>
        scopedWith(() => {
            // as parentScope should be avaliable and we don't introduce any side effects here.
            const resolve = inject(token, options);
            if (typeof resolve !== 'object' || resolve === null) {
                return resolve;
            }
            let expose = {};
            if (isBehavior(resolve)) {
                expose = resolve.value;
                return expose;
            }
            for (const [key, value] of Object.entries(resolve)) {
                if (typeof value === 'function') {
                    expose[key] = action(value);
                } else if (isBehavior(value)) {
                    expose[key] = value.value;
                } else {
                    expose[key] = value;
                }
            }
            return expose;
        }, parentScope)
    );

    useEffect(() => {
        if (parentScope.disposed) {
            return;
        }
        const { scope } = createScope(() => {
            const resolve = inject(token, options);
            if (typeof resolve !== 'object' || resolve === null) {
                return; // it's a constant.
            }
            if (isBehavior(resolve)) {
                resolve.watch(setExpose); // watch future updates
                return;
            }
            let expose = {};
            for (const [key, value] of Object.entries(resolve)) {
                if (typeof value === 'function') {
                    expose[key] = action(value);
                } else if (isBehavior(value)) {
                    expose[key] = value.value;
                    value.watch((updated) => {
                        expose = {
                            ...expose,
                            [key]: updated,
                        }; // need to construct a new object, otherwise react will ignore as object reference not changed.
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
