import { transaction, Cell, Scope, effect, lazy, mutValue } from 'kairo';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { KairoContext } from './context';

export const KairoApp: React.FunctionComponent<{
  globalSetup?: () => void;
}> = (props) => {
  const kairoScope = useMemo(() => {
    const scope = new Scope();
    const endScope = scope.beginScope();

    let propsSetter = [];
    $$CURRENT_HOOKS = [];
    const renderFn = props.globalSetup?.();
    Object.freeze(propsSetter);
    const hooks = $$CURRENT_HOOKS;
    $$CURRENT_HOOKS = null;
    endScope();
    return {
      renderFn,
      hooks,
      scope,
    };
  }, []);
  const { hooks, scope } = kairoScope;

  for (const hook of hooks) {
    hook(props);
  }

  useEffect(() => {
    return scope.attach();
  }, []);

  return (
    <KairoContext.Provider value={scope}>
      {props.children}
    </KairoContext.Provider>
  );
};

export function __unstable__runHooks<Props = any>(fn: (prop: Props) => void) {
  if ($$CURRENT_HOOKS === null) {
    throw Error(
      'You should only call is function when component initializing.'
    );
  }
  $$CURRENT_HOOKS.push(fn);
}

let $$CURRENT_HOOKS: Function[] | null = null;

export function withKairo<Props>(
  setup: (
    props: Props,
    useProp: <P>(selector: (x: Props) => P) => Cell<P>
  ) => React.FC<Props>
): React.FC<Props> {
  return function KairoComponent(props: PropsWithChildren<Props>) {
    const parentScope = useContext(KairoContext);
    const [_, setTick] = useState(0);
    const kairoScope = useMemo(() => {
      const scope = new Scope(parentScope);
      const endScope = scope.beginScope();

      let tick = 0;
      const propsSetter = [];
      $$CURRENT_HOOKS = [];
      const renderFn = setup(props, (selector) => {
        const [beh, set] = mutValue(selector(props));
        propsSetter.push((p: Props) => set(selector(p)));
        return beh;
      });
      Object.freeze(propsSetter);
      $$CURRENT_HOOKS.push((currentProps: Props) => {
        // the length should be fixed
        if (propsSetter.length) {
          useEffect(() => {
            // a hook to detect props change
            transaction(() => {
              propsSetter.forEach((x) => x(currentProps));
            });
          });
        }
      });
      const renderComp = lazy<ReturnType<typeof renderFn>>();
      effect(() => {
        const stop = renderComp.watch(() => {
          setTick(++tick);
        });
        renderComp.execute(() => renderFn(props)); // start
        return () => {
          stop();
        };
      });

      const hooks = $$CURRENT_HOOKS;
      $$CURRENT_HOOKS = null;

      endScope();
      return {
        renderFn,
        hooks,
        renderComp,
        scope,
      };
    }, []);
    const { hooks, renderFn, renderComp, scope } = kairoScope;

    useEffect(() => {
      return scope.attach();
    }, []);

    for (const hook of hooks) {
      hook(props);
    }

    return (
      <KairoContext.Provider value={scope}>
        {renderComp.execute(() => renderFn(props))}
      </KairoContext.Provider>
    );
  };
}
