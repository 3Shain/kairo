import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

let width = 10;

export function triangle(bridge: Bridge) {
  let head = bridge.cell(0);
  let current = head as ReadableCell<number>;
  let list: ReadableCell<number>[] = [];
  for (let i = 0; i < width; i++) {
    let c = current;
    list.push(current);
    current = bridge.computed(() => {
      return c.read() + 1;
    });
  }
  let sum = bridge.computed(() => {
    return list.map((x) => x.read()).reduce((a, b) => a + b, 0);
  });

  bridge.watch(
    () => sum.read(),
    () => callCounter?.()
  );

  let callCounter: Function = null;
  return () => {
    const constant = count(width);
    head.write(1);
    assert(sum.read(), constant);
    const atleast = callAtLeast(100, true);
    callCounter = () => atleast.call();
    for (let i = 0; i < 100; i++) {
      head.write(i);
      assert(sum.read(), constant - width + i * width);
    }
    callCounter = null;
    atleast.assert();
  };
}

function count(number) {
  return new Array(number)
    .fill(null)
    .map((_, i) => i + 1)
    .reduce((x, y) => x + y, 0);
}
