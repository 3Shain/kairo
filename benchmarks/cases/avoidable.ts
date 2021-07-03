import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

export function avoidablePropagation(bridge: Bridge) {
  /** avoidable change propagation  */
  {
    let head = bridge.cell(0);
    let computed1 = bridge.computed(() => head.read());
    let computed2 = bridge.computed(() => (computed1.read(), 0));
    let computed3 = bridge.computed(() => (busy(),(computed2.read() + 1))); // heavy computation
    let computed4 = bridge.computed(() => computed3.read() + 2);
    let computed5 = bridge.computed(() => computed4.read() + 3);
    bridge.watch(
      () => computed5.read(),
      () => busy() // heavy side effect
    );

    return () => {
      head.write(1);
      assert(computed5.read(), 6);
      for (let i = 0; i < 1000; i++) {
        head.write(i);
        assert(computed5.read(), 6);
      }
    };
  }
}
