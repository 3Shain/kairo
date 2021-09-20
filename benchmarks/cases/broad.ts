import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

export function broadPropagation(bridge: Bridge) {
  /** broad propagation */
  {
    let head = bridge.cell(0);
    let last = head as ReadableCell<number>;
    let callCounter: Function = null;
    for (let i = 0; i < 50; i++) {
      let current = bridge.computed(() => {
        return head.read() + i;
      });
      let current2 = bridge.computed(() => {
        return current.read() + 1;
      });
      bridge.watch(
        () => current2.read(),
        () => {
          callCounter?.();
        }
      );
      last = current2;
    }


    return () => {
      head.write(1);
      const atleast = callAtLeast(50 * 50);
      callCounter = () => atleast.call();
      for (let i = 0; i < 50; i++) {
        head.write(i);
        assert(last.read(), i  + 50);
      }
      callCounter = null;
      atleast.assert();
    };
  }
}
