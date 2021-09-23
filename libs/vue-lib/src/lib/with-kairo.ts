import {
  Reaction,
  collectScope,
  lifecycle,
  Cell,
  Context,
  LifecycleScope,
  Reference,
} from 'kairo';
import {
  customRef,
  DefineComponent,
  inject,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  SetupContext,
  defineComponent,
  VNodeChild,
  RenderFunction,
  ref,
} from 'vue';
import { CONTEXT } from './context';

Object.defineProperty(Cell.prototype, '__v_isRef', {
  value: true,
});

export function useScopeController(scope: LifecycleScope) {
  let detachHandler: Function | null = null;

  onMounted(() => {
    detachHandler = scope.attach();
  });
  onUnmounted(() => {
    if (insideKeepAlive) return;
    detachHandler!();
    detachHandler = null;
  });

  let insideKeepAlive = false;
  let deactivating = false;
  onActivated(() => {
    insideKeepAlive = true;
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
}

export function withKairo<Props>(
  component: (props: Props, ctx: SetupContext) => (props: Props) => VNodeChild
) {
  return patchComponent(
    defineComponent<Props>((props, ctx) => {
      const renderFn = component(props, ctx); // TODO:
      return (() => {
        return renderFn({ ...props });
      }) as RenderFunction;
    })
  );
}

export function patchComponent<T extends DefineComponent>(component: T) {
  const { setup, render } = component;

  if (setup) {
    component.setup = function (
      this: undefined,
      props: Parameters<T['setup']>[0],
      setupContext: SetupContext
    ) {
      const stopCollecting = collectScope();
      const context = inject(CONTEXT, Context.EMPTY);
      const exitContext = context.runInContext();
      try {
        const bindings = setup(props, setupContext);
        if (bindings instanceof Promise) {
          throw Error('Async component is not supported.');
        }
        const tracker = ref(0);
        const r = new Reaction(() => {
          tracker.value++;
        });
        lifecycle(() => {
          return () => r.dispose();
        });
        if (typeof bindings === 'function') {
          return (...args: unknown[]) => (
            // @ts-ignore
            tracker.value, r.execute(() => bindings(...args))
          );
        }
        const mappedBindings = Object.fromEntries(
          Object.entries((bindings as object) ?? {}).map(([key, value]) => {
            if (value instanceof Reference) {
              return [
                key,
                customRef(() => {
                  return {
                    get() {
                      return value.current;
                    },
                    set(v: any) {
                      value.current = v;
                    },
                  };
                }),
              ];
            }
            return [key, value];
          })
        );
        return {
          ...mappedBindings,
          tracker,
          r,
        };
      } finally {
        exitContext();
        useScopeController(stopCollecting());
      }
    };
    if (render) {
      component.render = patchRender(render);
    }
  }
  return component;
}

function patchRender(originalRender: Function) {
  return function render(
    this: any,
    _ctx: any,
    _cache: any,
    $props: any,
    $setup: any,
    $data: any,
    $options: any
  ) {
    const ret = _ctx.r.execute(
      () => originalRender(_ctx, _cache, $props, $setup, $data, $options),
      _ctx.tracker as void
    );
    return ret;
  };
}
