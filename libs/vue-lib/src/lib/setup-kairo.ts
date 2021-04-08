import {
    createScope,
    disposeScope,
    isBehavior,
    action,
    Behavior,
    mutable,
} from 'kairo';
import {
    ref,
    watch,
    inject,
    provide,
    onUnmounted,
    SetupContext,
    ComponentPublicInstance,
    App,
} from 'vue';
import { SCOPE } from './context';
import { RemoveBehaviors } from './types';

export function kairoApp(setup?: (app: App) => void) {
    return (app: App) => {
        const { scope } = createScope(() => {
            setup?.(app);
        });

        app.provide(SCOPE, scope);
    };
}

export function setupKairo<Props, Bindings>(
    setup: (
        props: Props,
        useProp: <T>(thunk: (props: Props) => T) => Behavior<T>,
        ctx: SetupContext
    ) => Bindings
): (props: Props, ctx: SetupContext) => RemoveBehaviors<Bindings> {
    return function (props: Props, setupContext: SetupContext) {
        const { scope, exposed } = createScope(() => {
            const exposed = setup(
                {
                    ...props,
                },
                (thunk: (_: Props) => any) => {
                    const [prop, setProp] = mutable(thunk(props));
                    watch(
                        () => thunk(props),
                        (value) => {
                            setProp(value);
                        }
                    );
                    return prop;
                },
                setupContext
            );
            if (typeof exposed !== 'object' || exposed === null) {
                console.log('?');
                return exposed; // let vue handle this.
            }
            return Object.fromEntries(
                Object.entries(exposed).map(([key, value]) => {
                    if (isBehavior(value)) {
                        const _ref = ref(value.value as object);
                        value.watch((s) => (_ref.value = s as object));
                        return [key, _ref];
                    }
                    if (typeof value === 'function') {
                        return [key, action(value as any)];
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
