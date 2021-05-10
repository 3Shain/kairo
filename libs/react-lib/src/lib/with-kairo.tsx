import {
    transaction,
    Behavior,
    __executeRenderEffect,
    __createRenderEffect,
    Scope,
    effect,
    __watch,
    __disposeWatcher,
    mut,
} from 'kairo';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { KairoContext } from './context';

export const KairoApp: React.FunctionComponent<{
    globalSetup: () => void;
}> = (props) => {
    const kairoScope = useMemo(
        () =>
            new Scope(() => {
                let propsSetter = [];
                $$CURRENT_HOOKS = [];
                const renderFn = props.globalSetup();
                Object.freeze(propsSetter);
                const hooks = $$CURRENT_HOOKS;
                $$CURRENT_HOOKS = null;
                return {
                    renderFn,
                    hooks,
                };
            }),
        []
    );

    for (const hook of kairoScope.exported.hooks) {
        hook(props);
    }

    useEffect(() => {
        return kairoScope.attach();
    }, []);

    return (
        <KairoContext.Provider value={kairoScope}>
            {props.children}
        </KairoContext.Provider>
    );
};

export function __unstable__runHooks<Props = any>(fn: (prop: Props) => void) {
    if ($$CURRENT_HOOKS === null) {
        throw Error(
            'You should only call is function when component initializing.'
        );
    }
    $$CURRENT_HOOKS.push(fn);
}

let $$CURRENT_HOOKS: Function[] | null = null;

export function withKairo<Props>(
    setup: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => React.FC<Props>
): React.FC<Props> {
    return function KairoComponent(props: PropsWithChildren<Props>) {
        const parentScope = useContext(KairoContext);
        const [_, setTick] = useState(0);
        const kairoScope = useMemo(
            () =>
                new Scope(() => {
                    let tick = 0;
                    const propsSetter = [];
                    $$CURRENT_HOOKS = [];
                    const renderFn = setup(props, (selector) => {
                        const [beh, set] = mut(selector(props));
                        propsSetter.push((p: Props) => set(selector(p)));
                        return beh;
                    });
                    Object.freeze(propsSetter);
                    $$CURRENT_HOOKS.push((currentProps: Props) => {
                        // the length should be fixed
                        if (propsSetter.length) {
                            useEffect(() => {
                                // a hook to detect props change
                                transaction(() => {
                                    propsSetter.forEach((x) => x(currentProps));
                                });
                            });
                        }
                    });
                    const _effect = __createRenderEffect();
                    effect(() => {
                        const node = __watch(_effect, () => {
                            setTick(++tick);
                        });
                        __executeRenderEffect(_effect, renderFn, props); // start
                        return () => __disposeWatcher(node);
                    });

                    const hooks = $$CURRENT_HOOKS;
                    $$CURRENT_HOOKS = null;
                    return {
                        renderFn,
                        hooks,
                        effect: _effect,
                    };
                }, parentScope),
            []
        );

        useEffect(() => {
            return kairoScope.attach();
        }, []);

        for (const hook of kairoScope.exported.hooks) {
            hook(props);
        }

        return (
            <KairoContext.Provider value={kairoScope}>
                {__executeRenderEffect(
                    kairoScope.exported.effect,
                    kairoScope.exported.renderFn,
                    props
                )}
            </KairoContext.Provider>
        );
    };
}
