import { EventStream } from './stream';
import { lifecycle } from './lifecycle-scope';
import { mutValue } from './cell';

export function held<T>(stream: EventStream<T>, initial: T) {
  const [behavior, setBehavior] = mutValue(initial);
  lifecycle(() => stream.listen(setBehavior));
  return behavior;
}

export function reduced<T, R>(
  stream: EventStream<T>,
  reducer: (current: R, next: T) => R,
  initial: R
) {
  const [behavior, setBehavior] = mutValue(initial);
  lifecycle(() =>
    stream.listen((next) => {
      setBehavior(reducer(behavior.value, next));
    })
  );
  return behavior;
}
