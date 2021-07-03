import { ReadableCell, Bridge, callAtLeast, assert } from '../common';

export function deepPropagation(bridge: Bridge) {
  /** deep propagation */

  let head = bridge.cell(0);
  let current = head as ReadableCell<number>;
  for (let i = 0; i < 50; i++) {
    let c = current;
    current = bridge.computed(() => {
      return c.read() + 1;
    });
  }

  const stop = bridge.watch(
    () => current.read(),
    () => {
      callCounter?.();
    }
  );

  let callCounter: Function = null;

  return () => {
    head.write(1);
    const atleast = callAtLeast(50);
    callCounter = () => atleast.call();
    for (let i = 0; i < 50; i++) {
      head.write(i);
      assert(current.read(), 50 + i);
    }
    callCounter = null;
    atleast.assert();
    // stop();
  };
}
