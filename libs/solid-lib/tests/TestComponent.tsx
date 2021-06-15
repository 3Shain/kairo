import { withKairo } from '../src';
import { mut } from 'kairo';

export const TestComponent = withKairo<{ a: number }>(() => {
  const [count, setCount] = mut(12345);
  return () => <div>{count.value}</div>;
});

export const UpdateProps = withKairo<{
  prop: number;
}>((_, useProp) => {
  const prop = useProp((x) => x.prop);
  return () => <div>{prop.value}</div>;
});
