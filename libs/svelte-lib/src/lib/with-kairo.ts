import { Behavior, createScope, disposeScope, Scope, unscoped } from 'kairo';
import { KairoContext } from './context';
import { getContext, onDestroy, setContext } from 'svelte';

export function withKairo(fn: Function) {
    let currentContext = getContext(KairoContext) as Scope;
    if (currentContext?.disposed) {
        // it's a bug from hot reload, we might get a staled context.
        currentContext = undefined;
    }
    const { scope, exposed } = createScope(fn as any, currentContext);
    onDestroy(() => {
        // setContext(KairoContext,null);
        disposeScope(scope);
    });
    setContext(KairoContext, scope);
    return exposed;
}
