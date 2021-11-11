import { collectScope, CONCERN_HOC_FACTORY, Context } from 'kairo';
import type { getContext, onDestroy, onMount, setContext } from 'svelte';
import { withConcern } from './application';
import { KairoContext } from './context';

export function beginScope<T>(
  _onDestroy: typeof onDestroy, // preserved?
  _setContext: typeof setContext,
  _getContext: typeof getContext,
  _onMount: typeof onMount
) {
  const context = _getContext<Context>(KairoContext) ?? Context.EMPTY;
  const exitScope = collectScope();
  const exitContext = context.inherit({
    [CONCERN_HOC_FACTORY]: withConcern
  }).runInContext();

  return () => {
    exitContext();
    const scope = exitScope();
    _onMount(() => {
      scope.attach();
      return () => scope.detach();
    });
  };
}
