import { Component, onCleanup, getListener, createContext as solidCreateContext, createComponent, useContext, createEffect, createSignal } from 'solid-js';
import { Behavior, data, createScope, disposeScope } from 'kairo';
import type { JSX } from 'solid-js';

const originalGetter = Object.getOwnPropertyDescriptor(Behavior.prototype, 'value').get;

Object.defineProperty(Behavior.prototype, 'value', {
    get(this: Behavior & { signal?: [Function, Function] }) {
        if (!this.signal) {
            this.signal = createSignal(originalGetter);
            this.watch((v) => {
                this.signal[1](v);
            });
        }
        if (getListener() !== null) {
            this.signal[0](); // trigger a solid read
        }
        return originalGetter.call(this);
    }
});

const KairoContext = solidCreateContext(null);

function KairoApp(props: {
    globalSetup: () => void,
    children: JSX.Element
}) {
    const scope = createScope(props.globalSetup, null);

    onCleanup(() => {
        disposeScope(scope.scope);
    });

    return createComponent(KairoContext.Provider, {
        value: scope.scope,
        get children() {
            return props.children;
        }
    })
}

type PropsInBehavior<T> = {
    [P in keyof T]: Behavior<T[P]>;
}

function withKairo<Props>(
    component: (props: PropsInBehavior<Props>) => Component<{}>
): Component<Props> {
    return (props: Props & {
        children?: JSX.Element;
    }) => {

        const parent = useContext(KairoContext);

        const { scope, exposed: realComponent } = createScope(() => {
            const behaviors = [];
            for (const key of Object.keys(props)) {
                if (key === 'children') {
                    continue;
                }
                const [behavior, setBehavior] = data(props[key]);  //TODO: schedule asap
                createEffect(() => {
                    setBehavior(props[key]);
                });
                behaviors.push([key, behavior]);
            }
            return component(Object.fromEntries(behaviors) as any);
        }, parent);

        onCleanup(() => {
            disposeScope(scope);
        });

        return createComponent(KairoContext.Provider, {
            value: scope,
            get children() {
                return createComponent(realComponent, {
                    get children() {
                        return props.children;
                    }
                });
            }
        });
    }
}

export { KairoApp, withKairo };