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
import type { PropsWithChildren, ReactElement } from 'react';
import { KairoContext } from './context';

export const KairoApp: React.FunctionComponent<{
    globalSetup: () => void;
}> = (props) => {
    const [kairoContext, setKairoContext] = useState<
        [
            ReturnType<typeof createScope>,
            ReturnType<typeof __createRenderEffect>
        ]
    >(null);

    const [] = useState(null);

    useEffect(() => {
        const { scope } = createScope(() => {
            props.globalSetup(); // TODO: setup props...
        });
        setKairoContext([{ scope } as any, undefined]);
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
    if (currentHooksCollector === null) {
        throw Error(
            'You should only call is function when component initializing.'
        );
    }
    currentHooksCollector.push(fn);
}

let currentHooksCollector: Function[] | null = null;

export function withKairo<Props>(
    setup: (
        props: Props,
        useProp: <P>(selector: (x: Props) => P) => Behavior<P>
    ) => React.FC<{}>
): React.FC<Props> {
    return React.memo(function KairoComponent(props: PropsWithChildren<Props>) {
        const [_, setTick] = useState(0);
        const parentScope = useContext(KairoContext);
        const [kairoContext, setKairo] = useState<
            [
                ReturnType<typeof createScope>,
                ReturnType<typeof __createRenderEffect>,
                Function[]
            ]
        >(null);
        const currentTick = useRef(0);

        useEffect(() => {
            if (parentScope.disposed) {
                return;
            }
            const _effect = __createRenderEffect(() => {
                setTick(currentTick.current);
            });
            currentHooksCollector = [];
            const _context = createScope(() => {
                let propsHook = [];
                const renderFn = setup(props, (selector) => {
                    const [beh, set] = data(selector(props));
                    propsHook.push((p) => set(selector(p)));
                    return beh;
                });
                currentHooksCollector.push((currentProps: Props) => {
                    useEffect(() => {
                        transaction(() => {
                            propsHook.forEach((x) => x(currentProps));
                        });
                    });
                });
                registerDisposer(() => {
                    __cleanupRenderEffect(_effect);
                });
                return renderFn;
            }, parentScope);
            const hooks = currentHooksCollector;
            currentHooksCollector = null;
            setKairo([_context, _effect, hooks]);
            return () => {
                disposeScope(_context.scope);
            };
        }, [parentScope]);

        currentTick.current++;

        if (kairoContext) {
            const [context, effect, hooks] = kairoContext;
            return (
                <KairoContext.Provider value={context.scope}>
                    <KairoRender
                        fcs={hooks}
                        rprops={props}
                        effect={effect}
                        exposed={context.exposed}
                    />
                </KairoContext.Provider>
            );
        } else {
            return null;
        }
    });
}

function KairoRender(props: {
    fcs: Function[];
    rprops: any;
    effect: any;
    exposed: any;
}) {
    for (const fc of props.fcs) {
        fc(props.rprops); // they are real hooks and should not 'invoke state?'
    }
    return (
        <>{__executeRenderEffect(props.effect, props.exposed, props.rprops)}</>
    );
}
