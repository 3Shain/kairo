import { lifecycle, Reaction, collectScope, LifecycleScope, Cell } from 'kairo';
import {
  useContext,
  useEffect,
  useMemo,
  useReducer,
  forwardRef as reactForwardRef,
  useState,
} from 'preact/compat';
import { h } from 'preact';
import type { FunctionComponent, RenderableProps, VNode, Ref } from 'preact';
import type { ForwardFn } from 'preact/compat';
import { KairoContext } from './context';

type Render<T> = (
  track: typeof Cell.track,
  props: RenderableProps<T>
) => VNode<any> | null;
type RenderWithRef<R, T> = (
  track: typeof Cell.track,
  props: RenderableProps<T>,
  ref: Ref<R>
) => VNode<any> | null;

export function withKairo<Props>(setup: (props: Props) => Render<Props>) {
  const component: FunctionComponent<Props> = (props) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props));
  };
  component.displayName = setup.name;
  return component;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  const component: ForwardFn<Props, Ref> = (props, ref) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props, ref));
  };
  component.displayName = setup.name;
  return reactForwardRef(component);
}

const inc = (x: number) => x + 1;

function useKairoComponent<Props, Render>(
  props: Props,
  setup: (props: Props) => Render
) {
  const parentContext = useContext(KairoContext);
  const [, forceUpdate] = useState(0);
  const instance = useMemo(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
    let renderFunction: Render;
    let scope: LifecycleScope;
    let didMounted = false,
      didUpdateBeforeMounted = false;
    lifecycle(() => {
      didMounted = true;
      if (didUpdateBeforeMounted) {
        forceUpdate(inc); // schedule an update
        didUpdateBeforeMounted = false;
      }
      return () => {
        didMounted = false;
        renderReaction.dispose();
      };
    });
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    const renderReaction = new Reaction(() => {
      if (!didMounted) {
        renderReaction.dispose();
        didUpdateBeforeMounted = true;
      } else {
        forceUpdate(inc);
      }
    });

    return {
      renderFunction,
      renderReaction,
      scope,
    };
  }, []);
  useEffect(() => instance.scope.attach(), []);
  return instance;
}
