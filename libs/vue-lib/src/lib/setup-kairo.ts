import { isBehavior, Behavior, mutable, Scope, effect } from 'kairo';
import {
    ref,
    watch,
    inject,
    provide,
    onUnmounted,
    SetupContext,
    App,
    onMounted,
    onActivated,
    onDeactivated,
} from 'vue';
import { SCOPE } from './context';
import { RemoveBehaviors } from './types';

export function kairoApp(setup?: (app: App) => void) {
    return (app: App) => {
        const scope = new Scope();
        const endScope = scope.beginScope();
        setup?.(app);
        endScope();
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
        const scope = new Scope(inject(SCOPE, undefined));

        let detachHandler: Function | null = null;

        onMounted(() => {
            detachHandler = scope.attach();
        });

        onUnmounted(() => {
            detachHandler!();
            detachHandler = null;
        });

        let deactivating = false;

        onActivated(() => {
            if (deactivating) {
                detachHandler = scope.attach();
                deactivating = false;
            }
        });

        onDeactivated(() => {
            detachHandler!();
            detachHandler = null;
            deactivating = true;
        });

        provide(SCOPE, scope);

        const endScope = scope.beginScope();
        const exported = (() => {
            const exposed = setup(
                {
                    ...props,
                },
                (thunk: (_: Props) => any) => {
                    const [prop, setProp] = mutable(thunk(props));
                    effect(() =>
                        watch(
                            () => thunk(props),
                            (value) => {
                                setProp(value);
                            }
                        )
                    );
                    return prop;
                },
                setupContext
            );
            if (typeof exposed !== 'object' || exposed === null) {
                console.warn(
                    `setupKairo() expects an object but actually gets ${typeof exposed}`
                );
                return exposed; // let vue handle this.
            }
            return Object.fromEntries(
                Object.entries(exposed).map(([key, value]) => {
                    if (isBehavior(value)) {
                        const _ref = ref(value.value as object);
                        effect(() =>
                            value.watch((s) => {
                                _ref.value = s as object;
                            })
                        );
                        return [key, _ref];
                    }
                    return [key, value];
                })
            );
        })();
        endScope();
        return exported as RemoveBehaviors<Bindings>;
    };
}
