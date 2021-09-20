import { collectScope, Concern, Context } from 'kairo';
import { DefineComponent, defineComponent, h, inject, provide } from 'vue';
import { CONTEXT } from './context';
import { useScopeController } from './with-kairo';

export function withConcern<ComponentType extends DefineComponent>(
  concern: Concern,
  component: ComponentType
) {
  return defineComponent({
    props: component['props'],
    setup: (props, ctx) => {
      const parentContext = inject(CONTEXT, Context.EMPTY);
      const stopCollecting = collectScope();
      try {
        const context = parentContext.build(concern);
        provide(CONTEXT, context);
      } finally {
        useScopeController(stopCollecting());
      }
      return () => h(component, { ...props } as any, ctx.slots);
    },
  }) as ComponentType;
}
