import {
  collectScope,
  CONCERN_HOC_FACTORY,
  Context
} from 'kairo';
import {
  DefineComponent,
  defineComponent,
  inject,
  RenderFunction,
  SetupContext,
} from 'vue';
import { withConcern } from './application';
import { CONTEXT } from './context';
import { useScopeController } from './scope-controller';

export function withKairo<Props>(
  component: (props: Readonly<Props>, ctx: SetupContext) => RenderFunction
) {
  return patchComponent(
    defineComponent<Props>((props, ctx) => {
      return component(props, ctx);
    })
  );
}

export function patchComponent<T extends DefineComponent>(component: T) {
  const { setup } = component;

  if (setup) {
    component.setup = function (
      this: undefined,
      props: Parameters<T['setup']>[0],
      setupContext: SetupContext
    ) {
      const stopCollecting = collectScope();
      const context = inject(CONTEXT, Context.EMPTY);
      const exitContext = context
        .inherit({
          [CONCERN_HOC_FACTORY]: withConcern,
        })
        .runInContext();
      try {
        const bindings = setup(props, setupContext);
        /* istanbul ignore if: unexpected use cases */ if (
          bindings instanceof Promise
        ) {
          throw new Error('Async component is not supported.');
        }
        return bindings;
      } finally {
        exitContext();
        useScopeController(stopCollecting());
      }
    };
  }
  return component;
}
