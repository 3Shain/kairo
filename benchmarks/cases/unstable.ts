import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

/**
 * worst case.
 * @param bridge 
 * @returns 
 */
export function unstable(bridge: Bridge) {
  let head = bridge.cell(0);
  const double = bridge.computed(() => head.read() * 2);
  const inverse = bridge.computed(() => -head.read());
  let current = bridge.computed(() => {
    let result = 0;
    for (let i = 0; i < 10; i++) {
      result += head.read() % 2 ? double.read() : inverse.read();
    }
    return result;
  });

  bridge.watch(
    () => current.read(),
    () => callCounter?.()
  );
  let callCounter: Function = null;
  return () => {
    head.write(1);
    assert(current.read(), 20);
    const atleast = callAtLeast(100);
    callCounter = () => atleast.call();
    for (let i = 0; i < 100; i++) {
      head.write(i);
      assert(current.read(), i % 2 ? i * 2 * 10 : i * -10);
    }
    callCounter = null;
    atleast.assert();
  };
}