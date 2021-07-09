import {
  Component,
  onCleanup,
  getListener,
  createComponent,
  useContext,
  createSignal,
  createComputed,
  runWithOwner,
  getOwner,
  onMount,
} from 'solid-js';
import {
  Cell,
  ComputationalCell,
  isCell,
  mutValue,
  Scope,
  __current_collecting,
} from 'kairo';
import type { JSX } from 'solid-js';
import { KairoContext } from './context';

let $$READ_AS_PROP = false;

/**
 * side effects
 * patches prototype of Behavior
 */

Object.defineProperty(Cell.prototype, 'value', {
  get: createPatch(Object.getOwnPropertyDescriptor(Cell.prototype, 'value').get),
});

Object.defineProperty(ComputationalCell.prototype, 'value', {
  get: createPatch(
    Object.getOwnPropertyDescriptor(ComputationalCell.prototype, 'value').get
  ),
});

function createPatch(originalGetter: Function) {
  return function patchedGetter(
    this: Cell<any> & {
      signal_ref?: WeakMap<ReturnType<typeof getOwner>, [Function, Function]>;
    }
  ) {
    {
      if (__current_collecting()) {
        return originalGetter.call(this);
      }
      if ($$READ_AS_PROP) {
        throw this;
      }
      if (getListener()) {
        if (!this.signal_ref) {
          this.signal_ref = new WeakMap();
        }
        const ref = this.signal_ref.get(getListener().owner);
        if (ref === undefined) {
          const owner = getListener().owner;
          const disposeWatcher = this.watch((v) => {
            ref2[1](v);
          });
          const ref2 = createSignal(originalGetter.call(this));
          this.signal_ref.set(owner, ref2);
          runWithOwner(owner, () => {
            onCleanup(() => {
              disposeWatcher();
              this.signal_ref.delete(owner);
            });
          });
          return ref2[0]();
        } else {
          return ref[0]();
        }
      }
      return originalGetter.call(this);
    }
  };
}

function withKairo<Props>(
  setup: (
    props: Props,
    useProp: <P>(selector: (x: Props) => P) => Cell<P>
  ) => Component<Props>
): Component<Props> {
  return (
    props: Props & {
      children?: JSX.Element;
    }
  ) => {
    const parent = useContext(KairoContext);

    const scope = new Scope(parent);

    const endScope = scope.beginScope();
    const Component = setup(
      {
        ...props,
      } as any,
      (thunk) => {
        try {
          $$READ_AS_PROP = true;
          const [prop, setProp] = mutValue(thunk(props));
          createComputed(() => {
            setProp(thunk(props));
          });
          return prop;
        } catch (e) {
          /* istanbul ignore else */
          if (isCell(e)) return e as Cell<any>;
          else throw e;
        } finally {
          $$READ_AS_PROP = false;
        }
      }
    );
    endScope();

    onMount(() => {
      const dispose = scope.attach();
      onCleanup(dispose);
    });

    return createComponent(KairoContext.Provider, {
      value: scope,
      get children() {
        return createComponent(Component, props);
      },
    });
  };
}

export { withKairo };
