import React, { memo, useEffect, useRef, useState } from 'react';
import { KairoApp, useInject, withKairo } from '@kairo/react';
import { stream, provide, inject, InjectToken, Behavior } from 'kairo';
import AC from './joystick';

interface Props {
    uid: number;
}

function Counter() {
    const [plusEnv, plus] = stream<number>();
    const count = plusEnv.reduce((a, b) => a + b, 0);
    return {
        plus,
        count,
    };
}

const TestComponent = withKairo<Props>((_, useProp) => {
    const uid = useProp((x) => x.uid);
    const { plus, count } = provide(Counter);

    provide(testtoken, uid);
    // uid.watch(console.log);

    return ({ children }) => (
        <div>
            <button onClick={() => plus(-1)}>minus</button>
            <span>{count.value}</span>
            <button onClick={() => plus(1)}>plus</button>
            <span>{uid.value}</span>
            <ChildComponent /> {/* no bad word 🙊🙊🙊 */}
            <AC />
            {children}
        </div>
    );
});

const testtoken = new InjectToken<Behavior<number>>('test');

const ChildComponent = withKairo<{}>((_, useProp) => {
    // const uid = useProp((x) => x.uid);
    // const { plus, count } = provide(Counter);
    const { count } = inject(Counter);

    const uidd = inject(testtoken);
    // uid.watch(console.log);

    return ({ children }) => <p>{` ${uidd.value}`}</p>;
});

const NormalComponent: React.FC<{}> = () => {
    const { count, plus } = useInject(Counter);

    return <h1 onClick={(e) => plus(2)}>{count}</h1>;
};

export function App() {
    const [state, setstate] = useState(0);
    return (
        <>
            <KairoApp globalSetup={() => {}}>
                <TestComponent uid={state}>
                    <NormalComponent />
                </TestComponent>
                <button onClick={() => setstate(state + 1)}>set uid</button>
            </KairoApp>
        </>
    );
}

export default App;
