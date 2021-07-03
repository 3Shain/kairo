import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

export function broadPropagation(bridge: Bridge) {
  /** broad propagation */
  {
    let head = bridge.cell(0);
    let current = head as ReadableCell<number>;
    for (let i = 0; i < 50; i++) {
      current = bridge.computed(() => {
        return head.read() + i;
      });
      let c = current;
      let current2 = bridge.computed(() => {
        return c.read() + i;
      });
      bridge.watch(
        () => current2.read(),
        () => {
          callCounter?.();
        }
      );
    }

    let callCounter: Function = null;

    return () => {
      head.write(1);
      const atleast = callAtLeast(50 * 50);
      callCounter = () => atleast.call();
      for (let i = 0; i < 50; i++) {
        head.write(i);
        assert(current.read(), i + 49);
      }
      callCounter = null;
      atleast.assert();
    };
  }
}
