import { createScope, disposeScope, Scope } from 'kairo';
import { getContext, onDestroy, setContext } from 'svelte';
import { KairoContext } from './context';

export function withKairo<T>(
    fn: () => T,
    level: 'root' | 'module' | 'component'
) {
    if (level === 'root') {
        const { scope, exposed } = createScope(fn);
        onDestroy(() => {
            disposeScope(scope);
        });
        setContext(KairoContext, scope);
        return exposed;
    } else if (level === 'module') {
        // not well defined yet
        let currentContext = getContext(KairoContext) as Scope;
        if (currentContext?.disposed) {
            // it's a bug from hot reload, we might get a staled context.
            currentContext = undefined;
        }
        const { scope, exposed } = createScope(fn, null, currentContext?.root);
        onDestroy(() => {
            disposeScope(scope);
        });
        setContext(KairoContext, scope);
        return exposed;
    } else {
        let currentContext = getContext(KairoContext) as Scope;
        if (currentContext?.disposed) {
            // it's a bug from hot reload, we might get a staled context.
            currentContext = undefined;
        }
        const { scope, exposed } = createScope(fn, currentContext);
        onDestroy(() => {
            disposeScope(scope);
        });
        setContext(KairoContext, scope);
        return exposed;
    }
}
