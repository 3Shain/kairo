import {
    ComponentPublicInstance,
    defineComponent,
    inject,
    onUnmounted,
    provide,
    ref,
    renderSlot,
    SetupContext,
    VNodeChild,
    watch,
} from 'vue';
import {
    Behavior,
    createScope,
    disposeScope,
    mutable,
    registerDisposer,
    __cleanupRenderEffect,
    __createRenderEffect,
    __executeRenderEffect,
} from 'kairo';
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
        const { scope, exposed } = createScope(() => {
            const renderFn = setup(
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
                ctx
            );
            let trigger = ref(0);
            const renderEffect = __createRenderEffect(() => {
                triggerRef(trigger);
            });
            registerDisposer(() => {
                __cleanupRenderEffect(renderEffect);
            });
            return function (this: ComponentPublicInstance) {
                const _this = this;
                track(trigger, 'get' as TrackOpTypes, 'value');
                return __executeRenderEffect(renderEffect, () =>
                    renderFn.call(this, {
                        get children() {
                            return renderSlot(_this.$slots, 'default');
                        },
                    })
                );
            };
        }, inject(SCOPE, undefined));

        onUnmounted(() => {
            disposeScope(scope);
        });

        provide(SCOPE, scope);

        return exposed;
    });
}
