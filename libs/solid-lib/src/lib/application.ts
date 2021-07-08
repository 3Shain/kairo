import { Scope } from 'kairo';
import { Component, createComponent, onCleanup, onMount } from 'solid-js';
import { KairoContext } from './context';

export function createKairoApp(setup?: () => void) {
  const rootScope = new Scope();
  const endScope = rootScope.beginScope();
  // platform setup (tokens)
  setup?.();
  endScope();
  const topScope = new Scope(undefined, rootScope);
  const App: Component = (props) => {
    onMount(() => {
      onCleanup(rootScope.attach());
    });
    return createComponent(KairoContext.Provider, {
      value: topScope,
      get children() {
        return props.children;
      },
    });
  };

  return {
    scope: rootScope,
    App,
  };
}
