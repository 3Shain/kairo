import {
  Reaction,
  collectScope,
  lifecycle,
  Cell,
  Context,
  CONCERN_HOC_FACTORY,
} from 'kairo';
import type { Track } from 'kairo';
import {
  DefineComponent,
  inject,
  SetupContext,
  defineComponent,
  VNodeChild,
  RenderFunction,
  ref,
} from 'vue';
import { CONTEXT } from './context';
import { withConcern } from './application';
import { useScopeController } from './scope-controller';

Object.defineProperty(Cell.prototype, '__v_isRef', {
  value: true,
});
Object.defineProperty(Cell.prototype, 'value', {
  get: function (this: Cell<any>) {
    return ctx_track(this);
  },
});

let ctx_track: Track | null = null;


export function withKairo<Props>(
  component: (
    props: Props,
    ctx: SetupContext
  ) => (track: Track, props: Props) => VNodeChild
) {
  return patchComponent(
    defineComponent<Props>((props, ctx) => {
      const renderFn = component(props, ctx);
      return (() => {
        return renderFn(ctx_track, { ...props });
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
      const exitContext = context.inherit({
        [CONCERN_HOC_FACTORY]: withConcern
      }).runInContext();
      try {
        const bindings = setup(props, setupContext);
        /* istanbul ignore if: unexpected use cases */ if (
          bindings instanceof Promise
        ) {
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
            tracker.value,
            r.track(($) => {
              const tmp = ctx_track;
              ctx_track = $;
              // @ts-expect-error
              const ret = bindings(...args);
              ctx_track = tmp;
              return ret;
            })
          );
        }
        return {
          ...bindings,
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
    const tmp = ctx_track;
    const ret = (_ctx.r as Reaction).track(
      ($) => (
        (ctx_track = $),
        originalRender(_ctx, _cache, $props, $setup, $data, $options)
      ),
      // @ts-expect-error
      _ctx.tracker as void
    );
    ctx_track = tmp;
    return ret;
  };
}
