import { Concern, collectScope, Context, LifecycleScope } from 'kairo';
import { KairoContext } from './context';
import { h, ComponentType } from 'preact';
import { useEffect, useContext, useState } from 'preact/compat';

export function withConcern<P>(concern: Concern, Component: ComponentType<P>) {
  const Module: React.FunctionComponent<P> = (props) => {
    const parentContext = useContext(KairoContext);
    const [[context, scope]] = useState(() => {
      const exitScope = collectScope();
      try {
        return [parentContext.build(concern), exitScope()] as [
          Context,
          LifecycleScope
        ];
      } catch (e) /* istanbul ignore next: captured by react */ {
        exitScope();
        throw e;
      }
    });
    useEffect(() => scope.attach(), []);
    return h(KairoContext.Provider, {
      value: context,
      children: h(Component, props),
    });
  };

  return Module;
}
