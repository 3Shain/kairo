import {
    createScope,
    disposeScope,
    transaction,
    mutable as data,
    Behavior,
    __executeRenderEffect,
    __createRenderEffect,
    __cleanupRenderEffect,
    registerDisposer,
} from 'kairo';
import React, { useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { KairoContext } from './context';

export const KairoApp: React.FunctionComponent<{
    globalSetup: () => void;
}> = (props) => {
    const [kairoContext, setKairoContext] = useState<
        [ReturnType<typeof createScope>]
    >(null);

    useEffect(() => {
        const { scope } = createScope(() => {
            props.globalSetup(); // TODO: setup props...
        });
        setKairoContext([{ scope } as any]);
        return () => {
            setKairoContext(null);
            disposeScope(scope);
        };
    }, []);

    if (kairoContext) {
        return (
            <KairoContext.Provider value={kairoContext[0].scope}>
                {props.children}
            </KairoContext.Provider>
        );
    }
    return null;
};

export function __unstable__runHooks<Props = any>(fn: (prop: Props) => void) {
    if (CURRENT_HOOKS === null) {
        throw Error(
            'You should only call is function when component initializing.'
        );
    }
    CURRENT_HOOKS.push(fn);
}

let CURRENT_HOOKS: Function[] | null = null;

export function withKairo<Props>(
    setup: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => React.FC<Props>
): React.FC<Props> {
    // we don't need memo by default as kairo provides memo like mechanism
    return function KairoComponent(props: PropsWithChildren<Props>) {
        const [_, setTick] = useState(0);
        const parentScope = useContext(KairoContext);
        const [kairoContext, setKairoContext] = useState<
            [
                ReturnType<typeof createScope>,
                ReturnType<typeof __createRenderEffect>,
                Function[]
            ]
        >(null);
        const currentTick = useRef(0);

        useEffect(() => {
            if (parentScope.disposed) {
                // this might happen in fast-refresh
                return;
            }
            const _effect = __createRenderEffect(() => {
                setTick(currentTick.current);
            });
            CURRENT_HOOKS = [];
            const _context = createScope(() => {
                let propsSetter = [];
                const renderFn = setup(props, (selector) => {
                    const [beh, set] = data(selector(props));
                    propsSetter.push((p: Props) => set(selector(p)));
                    return beh;
                });
                Object.freeze(propsSetter);
                CURRENT_HOOKS.push((currentProps: Props) => {
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
                registerDisposer(() => {
                    __cleanupRenderEffect(_effect);
                });
                return renderFn;
            }, parentScope);
            setKairoContext([_context, _effect, CURRENT_HOOKS]);
            CURRENT_HOOKS = null;
            return () => {
                setKairoContext(null);
                disposeScope(_context.scope);
            };
        }, [parentScope]);

        currentTick.current++;

        if (kairoContext) {
            // 3Shain: I really don't like such a 'waterfall' mechanism
            // but it is just technically impossible to have a 'constructor-like'
            // feature that allows side-effect in react.
            // Otherwise it will fail to work in StrictMode (and maybe concurrent mode in future)
            const [context, effect, hooks] = kairoContext;
            return (
                <KairoContext.Provider value={context.scope}>
                    <KairoRender
                        hooks={hooks}
                        realProps={props}
                        effect={effect}
                        renderFn={context.exposed}
                    />
                </KairoContext.Provider>
            );
        } else {
            return null;
        }
    };
}

function KairoRender(props: {
    hooks: Function[];
    realProps: any;
    effect: any;
    renderFn: any;
}) {
    for (const hook of props.hooks) {
        hook(props.realProps); // they are real hooks and should not 'invoke state?'
    }
    return (
        <>
            {__executeRenderEffect(
                props.effect,
                props.renderFn,
                props.realProps
            )}
        </>
    );
}
