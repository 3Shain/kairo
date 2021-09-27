import { Concern, collectScope } from 'kairo';
import { KairoContext } from './context';
import { h, ComponentType } from 'preact';
import { useEffect, useContext, useMemo } from 'preact/compat';

export function withConcern<P>(concern: Concern, Component: ComponentType<P>) {
  const Module: React.FunctionComponent<P> = (props) => {
    const parentContext = useContext(KairoContext);
    const [context, scope] = useMemo(() => {
      const exitScope = collectScope();
      try {
        return [parentContext.build(concern), exitScope()];
      } catch (e) {
        exitScope();
        throw e;
      }
    }, []);
    useEffect(() => scope.attach(), []);
    return h(KairoContext.Provider, {
      value: context,
      children: h(Component, props),
    });
  };

  return Module;
}
