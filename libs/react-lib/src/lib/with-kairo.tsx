import { computed, createScope, disposeScope, Scope, transaction } from "kairo";
import React, { useEffect, useRef, useState } from "react";
import type { PropsWithChildren, ReactElement } from 'react';

// context required.
export function bound(fn: Function) {
    return () => transaction(fn as any);
}

export const KairoContext = React.createContext<any>(null);

export const KairoApp: React.FunctionComponent<{
    globalSetup: () => void
}> = (props) => {

    const kContext = useRef(null);
    if (kContext.current === null) {
        // it's the first rendering
        const scope = createScope(() => {
            props.globalSetup(); // TODO: setup props...
        });
        kContext.current = scope.scope;
    }

    return (<KairoContext.Provider value={kContext.current}>
        { props.children}
    </KairoContext.Provider>)
}

export function withKairo<Props>(
    setup: (props: Props) => React.FC<{}>,
    options?: {

    }
): React.FunctionComponent<Props> {
    return (props: PropsWithChildren<Props>) => {
        const [, setTick] = useState(0);
        const kContext = useRef<Scope>(null);
        // const componentComputation = useRef(null);
        const currentRendered = useRef<ReactElement>(null);
        const currentVersion = useRef<number>(0);

        if (kContext.current === null) {
            // it's the first rendering
            const scope = createScope(() => {
                const renderFn = setup(null); // TODO: setup props...
                const rendered = computed(() => renderFn(props));
                rendered.watch((elements) => {
                    currentRendered.current = elements;
                    setTick(++currentVersion.current);
                });
                currentRendered.current = rendered.value;
            });
            kContext.current = scope.scope;
        }

        useEffect(() => {
            return () => {
                disposeScope(kContext.current);
            }
        }, []);

        return <KairoContext.Provider value={kContext.current}>
            {currentRendered.current}
        </KairoContext.Provider>
    }
}