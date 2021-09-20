import { ReadableCell, Bridge, callAtLeast, assert, busy } from '../common';

let size = 30;

export function repeatedObservers(bridge: Bridge) {
  /** repeated observers */
  {
    let head = bridge.cell(0);
    let current = bridge.computed(() => {
      let result = 0;
      for (let i = 0; i < size; i++) {
        // tbh I think it's meanigless to be this big...
        result += head.read();
      }
      return result;
    });

    let callCounter: Function = null;
    bridge.watch(
      () => current.read(),
      () => callCounter?.()
    );

    return () => {
      head.write(1);
      assert(current.read(), size);
      const atleast = callAtLeast(100);
      callCounter = () => atleast.call();
      for (let i = 0; i < 100; i++) {
        head.write(i);
        assert(current.read(), i * size);
      }
      callCounter = null;
      atleast.assert();
    };
  }
}
