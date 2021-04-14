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
} from 'solid-js';
import {
    Behavior,
    createScope,
    disposeScope,
    ComputationalBehavior,
    mutable,
    unscoped,
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
        this: Behavior & {
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
            const ref = this.signal_ref.get(getListener().owner); // TODO: always expect an owner?
            if (ref === undefined) {
                const owner = getListener().owner;
                let ref = createSignal(originalGetter.call(this));
                this.signal_ref.set(owner, ref);
                const disposeWatcher = unscoped(() =>
                    this.watch((v) => {
                        ref[1](v);
                    })
                );
                runWithOwner(owner, () => {
                    onCleanup(() => {
                        disposeWatcher();
                        this.signal_ref.delete(owner);
                    });
                });
                return ref[0]();
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
        this: Behavior & {
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
                let ref = createSignal(originalComputationGetter.call(this));
                this.signal_ref.set(owner, ref);
                const disposeWatcher = unscoped(() =>
                    this.watch((v) => {
                        ref[1](v);
                    })
                );
                runWithOwner(owner, () => {
                    onCleanup(() => {
                        disposeWatcher();
                        this.signal_ref.delete(owner);
                    });
                });
                return ref[0]();
            } else {
                return ref[0]();
            }
        }
        return originalComputationGetter.call(this);
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
