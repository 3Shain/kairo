import {
    Component,
    onCleanup,
    getListener,
    createComponent,
    useContext,
    createSignal,
    createComputed,
} from 'solid-js';
import {
    Behavior,
    createScope,
    disposeScope,
    ComputationalBehavior,
    mutable,
} from 'kairo';
import type { JSX } from 'solid-js';
import { KairoContext } from './context';

/**
 * side effects
 * patches prototype of Behavior
 */
const originalGetter = Object.getOwnPropertyDescriptor(
    Behavior.prototype,
    'value'
).get;

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
    },
});

Object.defineProperty(ComputationalBehavior.prototype, 'value', {
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
    },
});

function KairoApp(props: { globalSetup: () => void; children: JSX.Element }) {
    const scope = createScope(props.globalSetup, null);

    onCleanup(() => {
        disposeScope(scope.scope);
    });

    return createComponent(KairoContext.Provider, {
        value: scope.scope,
        get children() {
            return props.children;
        },
    });
}

function withKairo<Props>(
    component: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => Component<{}>
): Component<Props> {
    return (
        props: Props & {
            children?: JSX.Element;
        }
    ) => {
        const parent = useContext(KairoContext);

        const { scope, exposed: realComponent } = createScope(() => {
            return component(
                {
                    ...props,
                } as any,
                (thunk) => {
                    const [prop, setProp] = mutable(thunk(props));
                    createComputed(() => {
                        setProp(thunk(props));
                    });
                    return prop;
                }
            );
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
                    },
                });
            },
        });
    };
}

export { KairoApp, withKairo };
