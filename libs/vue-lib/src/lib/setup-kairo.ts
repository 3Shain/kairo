import { isCell, Cell, mutValue, Scope, mount, Reference, lazy } from 'kairo';
import {
  ref,
  watch,
  inject as vueInject,
  provide as vueProvide,
  onUnmounted,
  SetupContext,
  onMounted,
  onActivated,
  onDeactivated,
  Ref,
  customRef,
  renderSlot,
  ComponentPublicInstance,
} from 'vue';
import { SCOPE } from './context';

export function setupKairo<Props, Bindings>(
  setup: (
    props: Props,
    useProp: <T>(thunk: (props: Props) => T) => Cell<T>,
    ctx: SetupContext
  ) => Bindings
): (
  props: Props,
  ctx: SetupContext
) => Bindings extends object ? ToModel<Bindings> : Bindings {
  return function (props: Props, setupContext: SetupContext) {
    const scope = new Scope(vueInject(SCOPE, undefined));

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

    vueProvide(SCOPE, scope);

    const endScope = scope.beginScope();

    const setupResult = setup(
      {
        ...props,
      },
      (thunk: (_: Props) => any) => {
        const [prop, setProp] = mutValue(thunk(props));
        mount(() => watch(() => thunk(props), setProp));
        return prop;
      },
      setupContext
    );
    if (typeof setupResult === 'function') {
      /** render function */
      const renderResult = customRef((track, trigger) => {
        const renderEffect = lazy();
        mount(() => {
          const stop = renderEffect.watch(() => {
            trigger();
          });
          return () => stop();
        });
        return {
          get: function (this: ComponentPublicInstance) {
            const _this = this;
            track();
            return renderEffect.execute(() =>
              setupResult({
                ...props /** destructing a shallow reactive object. */,
                get children() {
                  return renderSlot(_this.$slots, 'default');
                },
              })
            );
          },
          set() {
            throw TypeError('Unexpected mutation');
          },
        };
      });
      endScope();
      return function (this: unknown) {
        /** using internal property
         * TODO: we need a more stable implementation.
         */
        return renderResult['_get'].call(this);
      };
    }
    if (typeof setupResult !== 'object' || setupResult === null) {
      endScope();
      return setupResult as any; // let vue handle this.
    }
    const ret = Object.fromEntries(
      Object.entries(setupResult).map(([key, value]) => {
        if (value instanceof Reference) {
          return [
            key,
            customRef(() => {
              return {
                get: () => {
                  return value.current;
                },
                set: (v: any) => {
                  value.current = v;
                },
              };
            }),
          ];
        }
        if (isCell(value)) {
          const _ref = ref(value.value as object);
          mount(() =>
            value.watch((s) => {
              _ref.value = s as object;
            })
          );
          return [key, _ref];
        }
        return [key, value];
      })
    ) as ToModel<Bindings>;
    endScope();
    return ret;
  };
}

export type ToModel<T> = {
  [P in keyof T]: T[P] extends Cell<infer C>
    ? Ref<C>
    : T[P] extends Reference<infer R>
    ? Ref<R>
    : T[P];
};
