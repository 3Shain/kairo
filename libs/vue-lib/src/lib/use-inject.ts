import {
    action,
    Behavior,
    createScope,
    disposeScope,
    ExtractBehaviorProperty,
    Factory,
    inject,
    InjectToken,
    isBehavior,
    runIfScopeExist,
} from 'kairo';
import { inject as vueInject, ref, reactive, onUnmounted, Ref } from 'vue';
import { SCOPE } from './context';

export function useInject<T>(
    fn: Factory<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: true;
        skipSelf?: boolean;
        defaultValue: T;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
    token: InjectToken<T>,
    options?: {
        optional?: boolean;
        skipSelf?: boolean;
    }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject(token: any, options: any): any {
    runIfScopeExist(() => {
        throw Error('Use `inject` instead of `useInject` if inside a scope.');
    });
    let expose = {};
    const { scope } = createScope(() => {
        const resolve = inject(token, options);
        if (typeof resolve !== 'object' || resolve === null) {
            return resolve;
        }
        if (isBehavior(resolve)) {
            const tRef = ref(resolve.value);
            resolve.watch((updated) => {
                tRef.value = updated;
            });
            return tRef;
        }
        for (const [key, value] of Object.entries(resolve)) {
            if (typeof value === 'function') {
                expose[key] = action(value as any);
            } else if (isBehavior(value)) {
                const tRef = ref(value.value);
                value.watch((updated) => {
                    tRef.value = updated;
                });
                expose[key] = tRef;
            } else {
                expose[key] = value;
            }
        }
    }, vueInject(SCOPE));
    onUnmounted(() => {
        disposeScope(scope);
    });
    return reactive(expose);
}
