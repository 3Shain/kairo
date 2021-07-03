import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

export function mux(bridge: Bridge) {
  let heads = new Array(100).fill(null).map((_) => bridge.cell(0));
  const mux = bridge.computed(() => {
    return Object.fromEntries(heads.map((h) => h.read()).entries());
  });
  const splited = heads
    .map((_, index) => bridge.computed(() => mux.read()[index]))
    .map((x) => bridge.computed(() => x.read() + 1));

  splited.forEach((x) => {
    bridge.watch(
      () => x.read(),
      () => {}
    );
  });
  return () => {
    for (let i = 0; i < 10; i++) {
      heads[i].write(i);
      assert(splited[i].read(), i + 1);
    }
    for (let i = 0; i < 10; i++) {
      heads[i].write(i * 2);
      assert(splited[i].read(), i * 2 + 1);
    }
  };
}
