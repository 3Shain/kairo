import {
    ComponentPublicInstance,
    defineComponent,
    inject,
    onActivated,
    onDeactivated,
    onMounted,
    onUnmounted,
    provide,
    ref,
    renderSlot,
    SetupContext,
    VNodeChild,
    watch,
} from 'vue';
import { Behavior, effect, mutable, Scope, lazy } from 'kairo';
import { track, TrackOpTypes, triggerRef } from '@vue/reactivity';
import { SCOPE } from './context';

export function withKairo<Props>(
    setup: (
        props: Readonly<Props>,
        useProp: <T>(thunk: (props: Props) => T) => Behavior<T>,
        ctx: SetupContext
    ) => (
        this: ComponentPublicInstance,
        mockProps: { children?: VNodeChild }
    ) => VNodeChild | object
) {
    return defineComponent<Props>(function (props, ctx) {
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
            const renderFn = setup(
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
                ctx
            );
            let trigger = ref(0);
            const renderEffect = lazy();

            effect(() => {
                const stop = renderEffect.watch(() => {
                    triggerRef(trigger);
                });
                triggerRef(trigger);
                return () => stop();
            });
            return function (this: ComponentPublicInstance) {
                const _this = this;
                track(trigger, 'get' as TrackOpTypes, 'value');
                return renderEffect.execute(() =>
                    renderFn.call(_this, {
                        get children() {
                            return renderSlot(_this.$slots, 'default');
                        },
                    })
                );
            };
        })();
        endScope();
        return exported;
    });
}
