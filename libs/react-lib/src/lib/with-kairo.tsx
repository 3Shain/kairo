import {
    computed,
    createScope,
    disposeScope,
    Scope,
    transaction,
    data,
    Behavior,
} from 'kairo';
import React, { useEffect, useRef, useState } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';
import { KairoContext } from './context';

// context required.
export function bound(fn: Function) {
    return () => transaction(fn as any);
}

export const KairoApp: React.FunctionComponent<{
    globalSetup: () => void;
}> = (props) => {
    const kContext = useRef<Scope | null>(null);
    if (kContext.current === null) {
        // it's the first rendering
        const scope = createScope(() => {
            props.globalSetup(); // TODO: setup props...
        });
        kContext.current = scope.scope;
    }

    return (
        <KairoContext.Provider value={kContext.current}>
            {props.children}
        </KairoContext.Provider>
    );
};

export function __unstable__runHooks<Props = any>(fn: (prop: Props) => void) {
    if (currentHooksCollector === null) {
        throw Error(
            'You should only call is function when component initializing.'
        );
    }
    currentHooksCollector.push(fn);
}

let currentHooksCollector: Function[] | null = null;

export function withKairo<Props, c = any>(
    setup: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => React.FC<{}>
): React.FC<Props> {
    return (props: PropsWithChildren<Props>) => {
        const [_, setTick] = useState(0);
        const kContext = useRef<Scope>();
        const currentRendered = useRef<ReactElement>();
        const currentTick = useRef<number>(0);
        const hooks = useRef<Function[]>([]);

        if (kContext.current === undefined) {
            // it's the first rendering
            const { scope } = createScope(() => {
                const [children, setChildren] = data(props.children);
                currentHooksCollector = hooks.current;
                const renderFn = setup(props, (selector) => {
                    const [beh, set] = data(selector(props));
                    currentHooksCollector.push((currentProps: Props) => {
                        set(selector(currentProps));
                    });
                    return beh;
                });
                currentHooksCollector = null;
                hooks.current.push(function ({ children }) {
                    setChildren(children);
                });
                const rendered = computed(() =>
                    renderFn({ children: children.value })
                );
                rendered.watch((elements) => {
                    currentRendered.current = elements;
                    if (currentTick.current > 0) {
                        setTick(currentTick.current);
                    }
                });
                currentRendered.current = rendered.value;
            });
            kContext.current = scope;
        } else {
            const tmp = currentTick.current;
            currentTick.current = 0;
            transaction(() => {
                // update by hooks is combined to be a transaction
                for (const hook of hooks.current) {
                    hook(props);
                }
            }); // i'm not sure if this is effective but
            currentTick.current = tmp;
        }

        currentTick.current++;
        /**
         * next time this function is invoked:
         * if it is from react world: tick!==currentTick, then trigger a update
         * if it is from watch: tick===currentTick
         */
        console.log('one formal renderer');

        useEffect(() => {
            return () => {
                disposeScope(kContext.current!);
                hooks.current = null;
            };
        }, []);

        return (
            <KairoContext.Provider value={kContext.current!}>
                {currentRendered.current}
            </KairoContext.Provider>
        );
    };
}
