import { ReadableCell, Bridge, callAtLeast, assert } from '../common';

let len = 50;

export function deepPropagation(bridge: Bridge) {
  /** deep propagation */

  let head = bridge.cell(0);
  let current = head as ReadableCell<number>;
  for (let i = 0; i < len; i++) {
    let c = current;
    current = bridge.computed(() => {
      return c.read() + 1;
    });
  }
  let callCounter: Function = null;

  const stop = bridge.watch(
    () => current.read(),
    () => {
      callCounter?.();
    }
  );

  const iter = 50;

  return () => {
    head.write(1);
    const atleast = callAtLeast(iter);
    callCounter = () => atleast.call();
    for (let i = 0; i < iter; i++) {
      head.write(i);
      assert(current.read(), len + i);
    }
    callCounter = null;
    atleast.assert();
    // stop();
  };
}
