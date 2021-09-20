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
  untrack,
} from 'solid-js';
import { Cell, collectScope, Context, isCell, mutValue, Reaction } from 'kairo';
import type { JSX } from 'solid-js';
import { KairoContext } from './context';

let $$READ_AS_PROP = false;

/**
 * side effects
 * patches prototype
 */

Object.defineProperty(Cell.prototype, 'value', {
  get: createPatch(
    Object.getOwnPropertyDescriptor(Cell.prototype, 'value').get
  ),
});
Object.defineProperty(Cell.prototype, 'error', {
  get: createPatch(
    Object.getOwnPropertyDescriptor(Cell.prototype, 'error').get
  ),
});

function createPatch(originalGetter: Function) {
  return function patchedGetter(
    this: Cell<any> & {
      signal_ref?: WeakMap<ReturnType<typeof getOwner>, Function>;
    }
  ) {
    if ($$READ_AS_PROP) {
      throw this;
    }
    if (getListener()) {
      const { owner } = getListener();
      if (!this.signal_ref) {
        this.signal_ref = new WeakMap();
      }
      const refRead = this.signal_ref.get(owner);
      if (refRead === undefined) {
        const update = () => {
          reaction.execute(() =>
            write(untrack(() => originalGetter.call(this)))
          );
        };
        const reaction = new Reaction(update);
        const [read, write] = createSignal();
        update();
        this.signal_ref.set(owner, read);
        runWithOwner(owner, () => {
          onCleanup(() => {
            reaction.dispose();
            this.signal_ref.delete(owner);
          });
        });
        return read();
      } else {
        return refRead();
      }
    }
    return originalGetter.call(this);
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
    const context = useContext(KairoContext);

    const exitScope = collectScope();
    const exitContext = context.runInContext();
    let Component: Component<Props>;
    try {
      Component = setup(
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
    } finally {
      exitContext();
      const lifecycle = exitScope();
      onMount(() => {
        const dispose = lifecycle.attach();
        onCleanup(dispose);
      });
    }

    return createComponent(Component, props);
  };
}

export { withKairo };
