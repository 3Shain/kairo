import { collectScope, Concern, Context } from 'kairo';
import { getContext, onDestroy, onMount, setContext } from 'svelte';
import { SvelteComponent, SvelteComponentDev } from 'svelte/internal';
import { KairoContext } from './context';
import { createSSRComponent, createComponent } from './hoc';

function withConcern(concern: Concern, Component: typeof SvelteComponentDev) {
  const fn = () => {
    const parentContext: Context = getContext(KairoContext) ?? new Context();
    const exitScope = collectScope();
    const context = parentContext.build(concern);
    const scope = exitScope();
    setContext(KairoContext, context);
    onMount(() => {
      scope.attach();
    });
    onDestroy(() => {
      scope.detach();
    });
  };

  return Component.prototype instanceof SvelteComponent ||
    (Component as any) === SvelteComponent
    ? createComponent(fn, Component)
    : createSSRComponent(fn, Component);
}

export { withConcern };
