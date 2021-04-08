import React, { useEffect, useRef, useState } from 'react';
import { KairoApp, useInject, withKairo } from '@kairo/react';
import { stream, provide } from 'kairo';

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

    return ({ children }) => (
        <div>
            <button onClick={() => plus(-1)}>minus</button>
            <span>{count.value}</span>
            <button onClick={() => plus(1)}>plus</button>
            <span>{uid.value}</span>
            {children}
        </div>
    );
});

const NormalComponent: React.FC<{}> = () => {
    const { count, plus } = useInject(Counter);

    return <h1 onClick={(e) => plus(2)}>{count}</h1>;
};

export function App() {
    const [state, setstate] = useState(0);
    return (
        <>
            <KairoApp globalSetup={() => {}}></KairoApp>
            <TestComponent uid={state}>
                <NormalComponent />
            </TestComponent>
            <button onClick={() => setstate(state + 1)}>set uid</button>
        </>
    );
}

export default App;
