/// <reference types="react/experimental" />
import React, {
  unstable_useSyncExternalStore as useSyncExternalStore,
  useMemo,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import { Cell, collectScope, LifecycleScope, Reaction } from 'kairo';
import { KairoContext } from './context';

type FunctionComponent<T> = React.FunctionComponent<T>;
type ForwardRefRenderFunction<R, T> = React.ForwardRefRenderFunction<R, T>;

function withKairo<Props>(
  setup: (
    props: Props
  ) => FunctionComponent<Props & { useCell: <C>(cell: Cell<C>) => C }>
) {
  function Component(props: Props) {
    const render = useConcurrentKairoComponent(props, setup);

    const useCell = useCallback(<T>(cell: Cell<T>) => {
      const subscribe = useCallback((onChange: () => void) => {
        const reaction = new Reaction(onChange);
        reaction.track(() => cell.$);
        return () => reaction.dispose();
      }, []);
      return useSyncExternalStore(subscribe, () => cell.current);
    }, []);

    return render({
      ...props,
      useCell,
    });
  }
  return Component;
}

// function forwardRef<Props, Ref>(
//   setup: (
//     props: Props
//   ) => ForwardRefRenderFunction<
//     Ref,
//     Props & { useCell: <C>(cell: Cell<C>) => C }
//   >
// ) {
//   function Component(props: Props) {
//     const render = useConcurrentKairoComponent(props, setup);

//     const useCell = useCallback(<T>(cell: Cell<T>) => {
//       const subscribe = useCallback(
//         (onChange: () => void) => {
//           const reaction = new Reaction(onChange);
//           reaction.track(() => cell.$);
//           return () => reaction.dispose();
//         },
//         [cell]
//       );
//       const getSnapshot = useCallback(() => cell.current, [cell]);
//       useSyncExternalStore(subscribe, getSnapshot);
//     }, []);

//     return render({
//       ...props,
//       useCell,
//     });
//   }
//   return Component;
// }

function useConcurrentKairoComponent<Props>(
  props: Props,
  setup: (
    props: Props
  ) => FunctionComponent<Props & { useCell: <C>(cell: Cell<C>) => C }>
) {
  const parentContext = useContext(KairoContext);
  const [render, scope] = useMemo(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
    let renderFunction: FunctionComponent<Props>;
    let scope: LifecycleScope;
    try {
      renderFunction = setup(props);
    } finally {
      exitContext();
      scope = exitScope();
    }
    return [renderFunction, scope];
  }, []);

  useEffect(() => scope.attach(), []);

  return render;
}

export const ConcurrentMode = {
  withKairo,
  // forwardRef,
};
