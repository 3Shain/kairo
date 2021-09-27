import {
  Cell,
  lifecycle,
  Reaction,
  mutValue,
  collectScope,
  LifecycleScope,
} from 'kairo';
import React, {
  useContext,
  useEffect,
  useMemo,
  forwardRef as reactForwardRef,
  useState,
  useRef,
} from 'react';
import { KairoContext } from './context';

type FunctionComponent<T> = React.FunctionComponent<T>;
type ForwardRefRenderFunction<R, T> = React.ForwardRefRenderFunction<R, T>;

export function withKairo<Props>(
  setup: (props: Props) => FunctionComponent<Props>
) {
  const component: FunctionComponent<Props> = (props) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.execute(() => renderFunction(props));
  };
  component.displayName = setup.name;
  return component;
}

export function forwardRef<Props, Ref>(
  setup: (props: Props) => ForwardRefRenderFunction<Ref, Props>
) {
  const component: ForwardRefRenderFunction<Ref, Props> = (props, ref) => {
    const { renderFunction, renderReaction } = useKairoComponent(props, setup);

    return renderReaction.execute(() => renderFunction(props, ref));
  };
  component.displayName = setup.name;
  return reactForwardRef(component);
}

const inc = (x: number) => x + 1;

function useKairoComponent<Props>(
  props: Props,
  setup: (props: Props) => FunctionComponent<Props>
) {
  const parentContext = useContext(KairoContext);
  const [, forceUpdate] = useState(0);
  const instance = useMemo(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
    let renderFunction: FunctionComponent<Props>;
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
        // if it's the first render of strict mode,
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
