import { EventStream } from './stream';
import { effect } from './scope';
import { mutable } from './cell';

export function held<T>(stream: EventStream<T>, initial: T) {
  const [behavior, setBehavior] = mutable(initial);
  effect(() => stream.listen(setBehavior));
  return behavior;
}

export function reduced<T, R>(
  stream: EventStream<T>,
  reducer: (current: R, next: T) => R,
  initial: R
) {
  const [behavior, setBehavior] = mutable(initial);
  effect(() =>
    stream.listen((next) => {
      setBehavior(reducer(behavior.value, next));
    })
  );
  return behavior;
}
