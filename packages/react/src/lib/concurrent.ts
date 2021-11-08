/// <reference types="react/experimental" />
import React, {
  unstable_useSyncExternalStore as useSyncExternalStore,
  useCallback,
  useContext,
  useEffect,
  forwardRef as reactForwardRef,
  useState,
} from 'react';
import type { Track } from 'kairo';
import { Cell, collectScope, LifecycleScope, Reaction } from 'kairo';
import { KairoContext } from './context';

type Render<T> = (
  track: Track,
  props: React.PropsWithChildren<T>
) => React.ReactElement<any, any> | null;
type RenderWithRef<R, T> = (
  track: Track,
  props: React.PropsWithChildren<T>,
  ref: React.ForwardedRef<R>
) => React.ReactElement<any, any> | null;

function withKairo<Props>(setup: (props: Props) => Render<Props>) {
  function Component(props: Props) {
    const render = useConcurrentKairoComponent(props, setup);

    const useCell = useCallback(<T>(cell: Cell<T>) => {
      const subscribe = useCallback((onChange: () => void) => {
        const reaction = new Reaction(onChange);
        reaction.track(($) => $(cell));
        return () => reaction.dispose();
      }, []);
      return useSyncExternalStore(subscribe, () => cell.current);
    }, []);

    return render(useCell, props);
  }
  return Component;
}

function forwardRef<Props, Ref>(
  setup: (props: Props) => RenderWithRef<Ref, Props>
) {
  function Component(props: Props, ref: React.Ref<Ref>) {
    const render = useConcurrentKairoComponent(props, setup);

    const useCell = useCallback(<T>(cell: Cell<T>) => {
      const subscribe = useCallback((onChange: () => void) => {
        const reaction = new Reaction(onChange);
        reaction.track(($) => $(cell));
        return () => reaction.dispose();
      }, []);
      return useSyncExternalStore(subscribe, () => cell.current);
    }, []);

    return render(useCell, props, ref);
  }
  return reactForwardRef(Component);
}

function useConcurrentKairoComponent<Props, Render>(
  props: Props,
  setup: (props: Props) => Render
) {
  const parentContext = useContext(KairoContext);
  const [[render, scope]] = useState(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
    let renderFunction: Render;
    let scope: LifecycleScope;
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    return [renderFunction, scope] as [Render, LifecycleScope];
  });

  useEffect(() => scope.attach(), []);

  return render;
}

export const ConcurrentMode = {
  withKairo,
  forwardRef,
};
