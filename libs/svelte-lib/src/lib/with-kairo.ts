import { Scope } from 'kairo';
import type { getContext, onDestroy, onMount, setContext } from 'svelte';
import { KairoContext } from './context';

export function withKairo<T>(
    fn: () => T,
    level: 'root' | 'module' | 'component',
    _onDestroy: typeof onDestroy,
    _setContext: typeof setContext,
    _getContext: typeof getContext,
    _onMount: typeof onMount
) {
    let scope: Scope;
    if (level === 'root') {
        scope = new Scope(fn);
    } else if (level === 'module') {
        // not well defined yet
        let currentContext = _getContext(KairoContext) as Scope;
        scope = new Scope(fn, null, currentContext?.rootScope);
    } else {
        let currentContext = _getContext(KairoContext) as Scope;
        console.log(currentContext);
        scope = new Scope(fn, currentContext);
    }
    let detachHandler: () => void;
    _onMount(() => {
        detachHandler = scope.attach();
    });
    _onDestroy(() => {
        detachHandler!();
    });
    _setContext(KairoContext, scope);
    return scope.exported;
}
