import {
    ComponentPublicInstance,
    defineComponent,
    inject,
    onUnmounted,
    provide,
    Ref,
    ref,
    renderSlot,
    SetupContext,
    VNodeChild,
    watch,
} from 'vue';
import {
    Behavior,
    ComputationalBehavior,
    createScope,
    disposeScope,
    mutable,
} from 'kairo';
import { SCOPE } from './context';

/**
 * side effects
 * patches prototype of Behavior
 */
const originalGetter = Object.getOwnPropertyDescriptor(
    Behavior.prototype,
    'value'
).get;

Object.defineProperty(Behavior.prototype, 'value', {
    get(this: Behavior & { ref?: Ref<any> }) {
        if (VUE_RENDERING) {
            if (!this.ref) {
                this.ref = ref(this['internal'].value);
                this.watch((current) => {
                    this.ref.value = current;
                });
            }
            this.ref.value; // trigger vue read.
        }
        return originalGetter.call(this);
    },
});

Object.defineProperty(ComputationalBehavior.prototype, 'value', {
    get(this: Behavior & { ref?: Ref<any> }) {
        if (VUE_RENDERING) {
            if (!this.ref) {
                this.ref = ref(this['internal'].value);
                this.watch((current) => {
                    this.ref.value = current;
                });
            }
            this.ref.value; // trigger vue read.
        }
        return originalGetter.call(this);
    },
});

let VUE_RENDERING = false;

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
            const renderFn = setup.call(
                void 0,
                {
                    ...props,
                },
                (thunk: (_: Props) => unknown) => {
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
            return function (this: ComponentPublicInstance) {
                VUE_RENDERING = true;
                const _this = this;
                const vnodes = (renderFn as Function).call(this, {
                    get children() {
                        return renderSlot(_this.$slots, 'default');
                    },
                });
                VUE_RENDERING = false;
                return vnodes;
            };
        }, inject(SCOPE, undefined));

        onUnmounted(() => {
            disposeScope(scope);
        });

        provide(SCOPE, scope);

        return exposed;
    });
}
