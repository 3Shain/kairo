import { withKairo, __unstable__runHooks } from '../src';
import React from 'react';
import { mut } from 'kairo';

export const TestComponent = withKairo(() => {
  const [count, setCount] = mut(12345);
  return () => <div>{count.value}</div>;
});

export const UpdateProps = withKairo<{
  prop: number;
}>((_, useProp) => {
  const prop = useProp((x) => x.prop);
  return () => <div>{prop.value}</div>;
});

function useHooks() {
  __unstable__runHooks((props) => {});
}
