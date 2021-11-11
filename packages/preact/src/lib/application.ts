import { Concern, collectScope, Context, LifecycleScope, CONCERN_HOC_FACTORY } from 'kairo';
import { KairoContext } from './context';
import { h, ComponentType, FunctionComponent } from 'preact';
import { useEffect, useContext, useState } from 'preact/compat';

export function withConcern(concern: Concern) {
  return <Props>(Component: ComponentType<Props>) => {
    const Module: FunctionComponent<Props> = (props) => {
      const parentContext = useContext(KairoContext);
      const [[context, scope]] = useState(() => {
        const exitScope = collectScope();
        try {
          return [parentContext.inherit({
            [CONCERN_HOC_FACTORY]: withConcern
          }).build(concern), exitScope()] as [
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
    Module.displayName = `withConcern(${Component.name})`;

    return Module as ComponentType<Props>;
  };
}
