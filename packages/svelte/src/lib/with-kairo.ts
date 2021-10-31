import { collectScope, Context } from 'kairo';
import type { getContext, onDestroy, onMount, setContext } from 'svelte';
import { KairoContext } from './context';

export function beginScope<T>(
  _onDestroy: typeof onDestroy,
  _setContext: typeof setContext,
  _getContext: typeof getContext,
  _onMount: typeof onMount
) {
  const context = _getContext<Context>(KairoContext) ?? Context.EMPTY;
  const exitScope = collectScope();
  const exitContext = context.runInContext();

  return () => {
    exitContext();
    const scope = exitScope();
    _onMount(() => {
      scope.attach();
    });
    _onDestroy(() => {
      scope.detach();
    });
  };
}
