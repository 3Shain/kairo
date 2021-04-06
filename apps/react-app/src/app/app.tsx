import React, { useRef, useState } from 'react';
import { bound, withKairo } from '@kairo/react';
import { Behavior, stream } from 'kairo';


const TestComponent = withKairo((props: {
  uid: Behavior<number>
}) => {

  const [plusEnv, plus] = stream<number>();
  const count = plusEnv.reduce((a, b) => a + b, 0);

  return () => <div>
    <button ref={() => { }} onClick={(() => plus(-1))}>minus</button>
    <span>{count.value}</span>
    <button onClick={(() => plus(1))}>plus</button>
  </div>
});

export function App() {
  const [state, setstate] = useState(0);
  return (<>
    <TestComponent uid={state}></TestComponent>
    <button onClick={() => setstate(state + 1)}>set uid</button>
  </>);
}

export default App;
