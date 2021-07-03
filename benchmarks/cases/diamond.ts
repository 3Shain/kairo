import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

let width = 5;

export function diamond(bridge: Bridge) {
  let head = bridge.cell(0);
  let current: ReadableCell<number>[] = [];
  for (let i = 0; i < width; i++) {
    current.push(
      bridge.computed(() => {
        return head.read() + 1;
      })
    );
  }
  let sum = bridge.computed(() => {
    return current.map((x) => x.read()).reduce((a, b) => a + b, 0);
  });
  bridge.watch(
    () => sum.read(),
    () => callCounter?.()
  );

  let callCounter: Function = null;

  return () => {
    head.write(1);
    assert(sum.read(), 2 * width);
    const atleast = callAtLeast(500, true);
    callCounter = () => atleast.call();
    for (let i = 0; i < 500; i++) {
      head.write(i);
      assert(sum.read(), (i + 1) * width);
    }
    callCounter = null;
    atleast.assert();
  };
}
