import {
    createScope,
    data,
    disposeScope,
    transaction,
    isBehavior,
    action,
} from 'kairo';
import {
    ref,
    watch,
    toRefs,
    inject,
    provide,
    InjectionKey,
    onUnmounted,
} from 'vue';
import { RemoveBehaviors } from './types';

const SCOPE = Symbol('kairo scope') as InjectionKey<any>;

export function setupKairo<Props extends object, Bindings>(
    setup: (props: Props) => Bindings
): (props: Props) => RemoveBehaviors<Bindings> {
    return (props: Props) => {
        const { scope, exposed } = createScope(() => {
            const propRefs = toRefs(props);
            const propBehaviors = Object.fromEntries(
                Object.keys(propRefs).map((key) => [
                    key,
                    data(propRefs[key].value),
                ])
            );
            watch(
                () => props,
                (newValue, ov) => {
                    transaction(function updateProps() {
                        // TODO: make this scheduled.
                        // run in transaction
                        for (const [k, v] of Object.entries(newValue)) {
                            propBehaviors[k][1][1](v); // ...
                        }
                    });
                },
                { flush: 'sync' }
            );

            const exposed = setup(
                Object.fromEntries(
                    Object.entries(propBehaviors).map((s) => [s[0], s[1][0]])
                ) as any
            );
            return Object.fromEntries(
                Object.entries(exposed).map(([key, value]) => {
                    if (isBehavior(value)) {
                        const _ref = ref(value.value as object);
                        value.watch((s) => (_ref.value = s as object));
                        return [key, _ref];
                    }
                    if (typeof value === 'function') {
                        return [
                            key,
                            action(value),
                        ];
                    }
                    return [key, value];
                })
            );
        }, inject(SCOPE, undefined));

        onUnmounted(() => {
            disposeScope(scope);
        });

        provide(SCOPE, scope);
        return exposed as RemoveBehaviors<Bindings>;
    };
}