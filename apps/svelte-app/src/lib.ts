import { kairo, BehaviorRef } from 'kairo';
import { onMount, setContext, getContext, onDestroy } from 'svelte/internal';
import type { Readable } from 'svelte/store';
// import { writable, derived, readable, Readable } from 'svelte/store';

const contextKey = Symbol('context key');

type GetBindings<T> = {
    [P in keyof T]: T[P] extends BehaviorRef<infer C> ? Readable<C> : T[P];
}

export function setupKairo<Bindings>(
    setup: () => Bindings
): GetBindings<Bindings> {

    // const context = kairo(setup, getContext(contextKey));
    onDestroy(() => {
        // context.dispose();
    });
    // setContext(contextKey, context);

    return {

    } as any;
}