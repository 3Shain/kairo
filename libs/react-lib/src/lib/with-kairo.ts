import { Cell, lifecycle, Reaction, mutValue, collectScope } from 'kairo';
import React, {
  useContext,
  useEffect,
  useMemo,
  forwardRef as reactForwardRef,
  useState,
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
    const { render, renderComp } = useKairoComponent(props, setup);

    return renderComp.execute(() => render(props));
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
    const { render, renderComp } = useKairoComponent(props, setup);

    return renderComp.execute(() => render(props, ref));
  };
  component.displayName = setup.name;
  return reactForwardRef(component);
}

const inc = (x: number) => x + 1;

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
  const parentContext = useContext(KairoContext);
  const [, forceUpdate] = useState(0);
  const instance = useMemo(() => {
    const exitScope = collectScope();
    const exitContext = parentContext.runInContext();
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
      // TODO: bug: memory leak in strict-mode: unmanaged subscription.
      const renderNode = new Reaction(() => {
        // if not attached: recycle.
        forceUpdate(inc);
      });

      const hooks = $$CURRENT_HOOKS;

      return {
        render,
        hooks,
        renderComp: renderNode,
        scope: exitScope(),
      };
    } finally {
      exitContext();
      exitScope();
      $$CURRENT_HOOKS = null;
    }
  }, []);
  for (const hook of instance.hooks) {
    hook(props);
  }
  useEffect(() => instance.scope.attach(), []);
  useEffect(() => () => instance.renderComp.dispose(), []);
  return instance;
}
