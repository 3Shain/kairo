import { createScope, disposeScope, Scope } from 'kairo';
import type { getContext, onDestroy, setContext } from 'svelte';
import { KairoContext } from './context';

export function withKairo<T>(
    fn: () => T,
    level: 'root' | 'module' | 'component',
    _onDestroy: typeof onDestroy,
    _setContext: typeof setContext,
    _getContext: typeof getContext
) {
    if (level === 'root') {
        const { scope, exposed } = createScope(fn);
        _onDestroy(() => {
            disposeScope(scope);
        });
        _setContext(KairoContext, scope);
        return exposed;
    } else if (level === 'module') {
        // not well defined yet
        let currentContext = _getContext(KairoContext) as Scope;
        if (currentContext?.disposed) {
            // it's a bug from hot reload, we might get a staled context.
            currentContext = undefined;
        }
        const { scope, exposed } = createScope(fn, null, currentContext?.root);
        _onDestroy(() => {
            disposeScope(scope);
        });
        _setContext(KairoContext, scope);
        return exposed;
    } else {
        let currentContext = _getContext(KairoContext) as Scope;
        if (currentContext?.disposed) {
            // it's a bug from hot reload, we might get a staled context.
            currentContext = undefined;
        }
        const { scope, exposed } = createScope(fn, currentContext);
        _onDestroy(() => {
            disposeScope(scope);
        });
        _setContext(KairoContext, scope);
        return exposed;
    }
}
