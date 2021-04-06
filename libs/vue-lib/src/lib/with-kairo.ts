import { Behavior, createScope, disposeScope } from 'kairo';
import { ComponentPublicInstance, defineComponent, onUnmounted, Ref, ref, RenderFunction, SetupContext, triggerRef, VNodeChild } from 'vue';

const originalGetter = Object.getOwnPropertyDescriptor(Behavior.prototype, 'value').get;

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
    }
});

let VUE_RENDERING = false;

export function withKairo<Props>(
    setup: (props: Readonly<Props>, ctx: SetupContext) => ((instance: ComponentPublicInstance) => VNodeChild | object)
) {
    return defineComponent<Props>((props, ctx) => {
        const { scope, exposed } = createScope(() => {
            const renderFn = setup({} as any, ctx);
            return function (this: ComponentPublicInstance) {
                VUE_RENDERING = true;
                const vnodes = (renderFn as Function)(this, ctx);
                VUE_RENDERING = false;
                return vnodes;
            }
        });

        onUnmounted(() => {
            disposeScope(scope);
        });

        return exposed;
    });
}