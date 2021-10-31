import { collectScope, Concern } from 'kairo';
import { KairoContext } from './context';
import React, { useContext, useEffect, useMemo } from 'react';

export function withConcern<P>(
  concern: Concern,
  Component: React.ComponentType<P>
) {
  const Module: React.FunctionComponent<P> = (props) => {
    const parentContext = useContext(KairoContext);
    const [context, scope] = useMemo(() => {
      const exitScope = collectScope();
      try {
        return [parentContext.build(concern), exitScope()];
      } catch (e) /* istanbul ignore next: captured by react */ {
        exitScope();
        throw e;
      }
    }, []);
    useEffect(() => scope.attach(), []);
    return React.createElement(
      KairoContext.Provider,
      { value: context },
      React.createElement(Component, props)
    );
  };

  return Module;
}
