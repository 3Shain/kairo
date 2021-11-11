import {
  collectScope,
  Concern,
  CONCERN_HOC_FACTORY,
  Context,
  LifecycleScope,
} from 'kairo';
import { KairoContext } from './context';
import React, { useContext, useEffect, useState } from 'react';

export function withConcern(concern: Concern) {
  return <Props>(Component: React.ComponentType<Props>) => {
    const KairoModule: React.FunctionComponent<Props> = (props) => {
      const parentContext = useContext(KairoContext);
      const [[context, scope]] = useState(() => {
        const exitScope = collectScope();
        try {
          return [
            parentContext
              .inherit({
                [CONCERN_HOC_FACTORY]: withConcern,
              })
              .build(concern),
            exitScope(),
          ] as [Context, LifecycleScope];
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
    KairoModule.displayName = `withConcern(${Component.name})`;

    return KairoModule as React.ComponentType<Props>;
  };
}
