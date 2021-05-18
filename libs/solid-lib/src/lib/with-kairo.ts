import {
    Component,
    onCleanup,
    getListener,
    createComponent,
    useContext,
    createSignal,
    createComputed,
    runWithOwner,
    getOwner,
    createEffect,
} from 'solid-js';
import {
    Behavior,
    ComputationalBehavior,
    mutable,
    Scope,
    __current_collecting,
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
    get(
        this: Behavior<any> & {
            signal_ref?: WeakMap<
                ReturnType<typeof getOwner>,
                [Function, Function]
            >;
        }
    ) {
        if (__current_collecting()) {
            return originalGetter.call(this);
        }
        if (getListener()) {
            if (!this.signal_ref) {
                this.signal_ref = new WeakMap();
            }
            const ref = this.signal_ref.get(getListener().owner);
            if (ref === undefined) {
                const owner = getListener().owner;
                const disposeWatcher = this.watch((v) => {
                    ref2[1](v);
                });
                const ref2 = createSignal(originalGetter.call(this));
                this.signal_ref.set(owner, ref2);
                runWithOwner(owner, () => {
                    onCleanup(() => {
                        disposeWatcher();
                        this.signal_ref.delete(owner);
                    });
                });
                return ref2[0]();
            } else {
                return ref[0]();
            }
        }
        return originalGetter.call(this);
    },
});

const originalComputationGetter = Object.getOwnPropertyDescriptor(
    ComputationalBehavior.prototype,
    'value'
).get;

Object.defineProperty(ComputationalBehavior.prototype, 'value', {
    get(
        this: Behavior<any> & {
            signal_ref?: WeakMap<
                ReturnType<typeof getOwner>,
                [Function, Function]
            >;
        }
    ) {
        if (__current_collecting()) {
            return originalComputationGetter.call(this);
        }
        if (getListener()) {
            if (!this.signal_ref) {
                this.signal_ref = new WeakMap();
            }
            const ref = this.signal_ref.get(getListener().owner);
            if (ref === undefined) {
                const owner = getListener().owner;
                const disposeWatcher = this.watch((v) => {
                    ref2[1](v);
                });
                const ref2 = createSignal(originalComputationGetter.call(this));
                this.signal_ref.set(owner, ref2);
                runWithOwner(owner, () => {
                    onCleanup(() => {
                        disposeWatcher();
                        this.signal_ref.delete(owner);
                    });
                });
                return ref2[0]();
            } else {
                return ref[0]();
            }
        }
        return originalComputationGetter.call(this);
    },
});

function KairoApp(props: { globalSetup: () => void; children: JSX.Element }) {
    const scope = new Scope(props.globalSetup, null);

    createEffect(() => {
        const dispose = scope.attach();
        onCleanup(dispose);
    });

    return createComponent(KairoContext.Provider, {
        value: scope,
        get children() {
            return props.children;
        },
    });
}

function withKairo<Props>(
    component: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => Component<Props>
): Component<Props> {
    return (
        props: Props & {
            children?: JSX.Element;
        }
    ) => {
        const parent = useContext(KairoContext);

        const scope = new Scope(() => {
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

        createEffect(() => {
            const dispose = scope.attach();
            onCleanup(dispose);
        });

        return createComponent(KairoContext.Provider, {
            value: scope,
            get children() {
                return createComponent(scope.exported, props);
            },
        });
    };
}

export { KairoApp, withKairo };
