import { collectScope, Concern, CONCERN_HOC_FACTORY, Context } from 'kairo';
import {
  DefineComponent,
  defineComponent,
  h,
  inject,
  provide,
  getCurrentInstance,
} from 'vue';
import { CONTEXT } from './context';
import { useScopeController } from './scope-controller';

export function withConcern<ComponentType extends DefineComponent>(
  concern: Concern
) {
  return (component: ComponentType) => {
    return defineComponent({
      props: component['props'],
      setup: () => {
        const instance = getCurrentInstance();
        const parentContext = inject(CONTEXT, Context.EMPTY);
        const stopCollecting = collectScope();
        try {
          const context = parentContext.inherit({
            [CONCERN_HOC_FACTORY]: withConcern
          }).build(concern);
          provide(CONTEXT, context);
        } finally {
          useScopeController(stopCollecting());
        }
        return () => h(component, instance.vnode.props, instance.slots);
      },
    }) as ComponentType;
  };
}
