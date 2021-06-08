import { Scope } from 'kairo';
import type { getContext, onDestroy, onMount, setContext } from 'svelte';
import { KairoContext } from './context';

export function beginScope<T>(
    level: 'root' | 'module' | 'component',
    _onDestroy: typeof onDestroy,
    _setContext: typeof setContext,
    _getContext: typeof getContext,
    _onMount: typeof onMount
) {
    const scope = new Scope(_getContext(KairoContext));

    let detachHandler: () => void;
    _onMount(() => {
        detachHandler = scope.attach();
    });
    _onDestroy(() => {
        detachHandler();
    });

    _setContext(KairoContext, scope);

    return scope.beginScope();
}
