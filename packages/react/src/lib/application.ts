import { collectScope, Concern, Context, LifecycleScope } from 'kairo';
import { KairoContext } from './context';
import React, { useContext, useEffect, useMemo, useState } from 'react';

export function withConcern<P>(
  concern: Concern,
  Component: React.ComponentType<P>
) {
  const KairoModule: React.FunctionComponent<P> = (props) => {
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
    return React.createElement(
      KairoContext.Provider,
      { value: context },
      React.createElement(Component, props)
    );
  };

  return KairoModule;
}
