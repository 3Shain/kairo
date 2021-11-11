import { collectScope, Concern, CONCERN_HOC_FACTORY, Context } from 'kairo';
import { getContext, onMount, setContext } from 'svelte';
import { SvelteComponent, SvelteComponentDev } from 'svelte/internal';
import { KairoContext } from './context';
import { createSSRComponent, createComponent } from './hoc';

function withConcern(concern: Concern) {
  return (Component: typeof SvelteComponentDev) => {
    const fn = () => {
      const parentContext: Context = getContext(KairoContext) ?? new Context();
      const exitScope = collectScope();
      const context = parentContext.inherit({
        [CONCERN_HOC_FACTORY]: withConcern
      }).build(concern);
      const scope = exitScope();
      setContext(KairoContext, context);
      onMount(() => {
        scope.attach();
        return () => scope.detach();
      });
    };

    return Component.prototype instanceof SvelteComponent ||
      (Component as any) === SvelteComponent
      ? createComponent(fn, Component)
      : createSSRComponent(fn, Component);
  };
}

export { withConcern };
