import { transaction, Cell, Scope, mount, lazy, mutValue } from 'kairo';
import React, {
  useContext,
  useEffect,
  useMemo,
  useReducer,
  forwardRef as reactForwardRef,
} from 'react';
import { KairoContext } from './context';

type FunctionComponent<T> = React.FunctionComponent<T>;
type ForwardRefRenderFunction<R, T> = React.ForwardRefRenderFunction<R, T>;

let $$CURRENT_HOOKS: Function[] | null = null;

export function registerHook<Props = any>(fn: (prop: Props) => void) {
  /* istanbul ignore if */
  if ($$CURRENT_HOOKS === null) {
    throw Error(
      'You should only call is function when component initializing.'
    );
  }
  $$CURRENT_HOOKS.push(fn);
}

export function withKairo<Props>(
  setup: (
    props: Props,
    useProp: <P>(selector: (x: Props) => P) => Cell<P>
  ) => FunctionComponent<Props>
) {
  const component: FunctionComponent<Props> = (props) => {
    const { render, renderComp, scope } = useKairoComponent(props, setup);

    return (
      <KairoContext.Provider value={scope}>
        {renderComp.execute(() => render(props))}
      </KairoContext.Provider>
    );
  };
  component.displayName = setup.name;
  return component;
}

export function forwardRef<Props, Ref>(
  setup: (
    props: Props,
    useProp: <P>(selector: (x: Props) => P) => Cell<P>
  ) => ForwardRefRenderFunction<Ref, Props>
) {
  const component: ForwardRefRenderFunction<Ref, Props> = (props, ref) => {
    const { render, renderComp, scope } = useKairoComponent(props, setup);

    return (
      <KairoContext.Provider value={scope}>
        {renderComp.execute(() => render(props, ref))}
      </KairoContext.Provider>
    );
  };
  component.displayName = setup.name;
  return reactForwardRef(component);
}

function useKairoComponent<
  Props,
  RenderFunction extends (...args: any[]) => any
>(
  props: Props,
  setup: (
    props: Props,
    useProp: <P>(selector: (x: Props) => P) => Cell<P>
  ) => RenderFunction
) {
  const parentScope = useContext(KairoContext);
  const [, forceUpdate] = useReducer((c) => c + 1, 0);
  const instance = useMemo(() => {
    const scope = new Scope(parentScope);
    const endScope = scope.beginScope();

    const propsSetter = [];
    $$CURRENT_HOOKS = [];
    try {
      const render = setup(props, (selector) => {
        const [beh, set] = mutValue(selector(props));
        propsSetter.push((p: Props) => set(selector(p)));
        return beh;
      });
      Object.freeze(propsSetter);
      $$CURRENT_HOOKS.push((currentProps: Props) => {
        // the length should be fixed
        if (propsSetter.length) {
          useEffect(() => {
            propsSetter.forEach((x) => x(currentProps));
          });
        }
      });
      const renderNode = lazy<ReturnType<typeof render>>();
      mount(() => {
        const stop = renderNode.watch(() => {
          forceUpdate();
        });
        /* istanbul ignore if */
        if (renderNode.stale) {
          forceUpdate();
        }
        return stop;
      });

      const hooks = $$CURRENT_HOOKS;

      return {
        render,
        hooks,
        renderComp: renderNode,
        scope,
      };
    } finally {
      endScope();
      $$CURRENT_HOOKS = null;
    }
  }, []);
  transaction(() => {
    for (const hook of instance.hooks) {
      hook(props);
    }
  });
  useEffect(() => instance.scope.attach(), []);
  return instance;
}
