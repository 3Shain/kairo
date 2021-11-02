import { lifecycle, Reaction, collectScope, LifecycleScope, Cell } from 'kairo';
import React, {
  useContext,
  useEffect,
  useMemo,
  forwardRef as reactForwardRef,
  useState,
  useRef,
} from 'react';
import { KairoContext } from './context';

type Render<T> = (
  track: typeof Cell.track,
  props: React.PropsWithChildren<T>
) => React.ReactElement<any, any> | null;
type RenderWithRef<R, T> = (
  track: typeof Cell.track,
  props: React.PropsWithChildren<T>,
  ref: React.ForwardedRef<R>
) => React.ReactElement<any, any> | null;

export function withKairo<Props>(setup: (props: Props) => Render<Props>) {
  const component: React.FunctionComponent<Props> = (props) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.track(($) => renderFunction($, props));
  };
  component.displayName = setup.name;
  return component;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  const component: React.ForwardRefRenderFunction<Ref, Props> = (
    props,
    ref
  ) => {
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
        /**
         * it's really hard to cover this branch.
         * current work-around:
         * set a cell in children useEffect
         * the parent is going-to-mount but not mounted yet (coz children will be mounted before parent)
         * so the parent's reaction will dispose itself and tag `didUpdateBeforeMounted`
         * what a messy control flow...
         */
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
        /**
         * subscribe to a free-cell in first render of strict-mode will trigger this
         * or subscribed cells get modified while children getting mounted
         */
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
