import { Suite } from 'benchmark';
import {
  Bridge,
  KairoBridge,
  KairoInternal,
  MobxBridge,
  ReadableCell,
  SBridge,
  VueReactiveBridge,
  SolidBridge,
} from './common';

declare global {
  const __DEV__: boolean;
  const __TEST__: boolean;
}

(global as any).__DEV__ = false;
(global as any).__TEST__ = false;

function doTest(test: Function) {
  const suite = new Suite(test.name);
  console.log('Item: ' + test.name);
  suite
    .add(`Solid`, () => {
      SolidBridge.root(() => {
        test(SolidBridge);
      });
    })
    .add(`Vue`, () => {
      VueReactiveBridge.root(() => {
        test(VueReactiveBridge);
      });
    })
    .add(`MobX`, () => {
      MobxBridge.root(() => {
        test(MobxBridge);
      });
    })
    .add(`Kairo`, () => {
      KairoBridge.root(() => {
        test(KairoBridge);
      });
    })
    .add(`S.js`, () => {
      SBridge.root(() => {
        test(SBridge);
      });
    })
    .on('error', (e) => {
      console.log(e.target.error);
    })
    .on('cycle', (s) => {
      console.log(String(s.target));
      global.gc();
    })
    .run({
      async: false,
    })
    .on('complete', () => {});
}

doTest(deepPropagation);
doTest(broadPropagation);
doTest(diamondPropagation);
doTest(trianglePropagation);
doTest(repeatedObservers);
doTest(avoidablePropagation);
doTest(unstableObservers);
doTest(muxPropagation);
doTest(deepPropagation);

function deepPropagation(bridge: Bridge) {
  /** deep propagation */
  {
    let head = bridge.cell(0);
    let current = head as ReadableCell<number>;
    for (let i = 0; i < 500; i++) {
      let c = current;
      current = bridge.computed(() => {
        return c.read() + 1;
      });
    }
    head.write(1);
    const atleast = callAtLeast(500);
    bridge.watch(
      () => current.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 500; i++) {
      head.write(i);
      assert(current.read(), 500 + i);
    }
    atleast.assert();
  }
}

function broadPropagation(bridge: Bridge) {
  /** broad propagation */
  {
    let head = bridge.cell(0);
    let current = head as ReadableCell<number>;
    for (let i = 0; i < 2000; i++) {
      current = bridge.computed(() => {
        return head.read() + i;
      });
      bridge.watch(
        () => current.read(),
        () => {}
      );
    }
    head.write(1);
    const atleast = callAtLeast(50);
    bridge.watch(
      () => current.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 50; i++) {
      head.write(i);
      assert(current.read(), i + 1999);
    }
    atleast.assert();
  }
}

function diamondPropagation(bridge: Bridge) {
  /** diamond propagation */
  {
    let head = bridge.cell(0);
    let current: ReadableCell<number>[] = [];
    for (let i = 0; i < 1500; i++) {
      current.push(
        bridge.computed(() => {
          return head.read() + 1;
        })
      );
    }
    let sum = bridge.computed(() => {
      return current.map((x) => x.read()).reduce((a, b) => a + b, 0);
    });
    head.write(1);
    assert(sum.read(), 2 * 1500);
    const atleast = callAtLeast(500);
    bridge.watch(
      () => sum.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 500; i++) {
      head.write(i);
      assert(sum.read(), (i + 1) * 1500);
    }
    atleast.assert();
  }
}

function trianglePropagation(bridge: Bridge) {
  /** triangle propagation */
  {
    let head = bridge.cell(0);
    let current = head as ReadableCell<number>;
    let list: ReadableCell<number>[] = [];
    for (let i = 0; i < 1500; i++) {
      let c = current;
      list.push(current);
      current = bridge.computed(() => {
        return c.read() + 1;
      });
    }
    let sum = bridge.computed(() => {
      return list.map((x) => x.read()).reduce((a, b) => a + b, 0);
    });
    head.write(1);
    assert(sum.read(), 1125750);
    const atleast = callAtLeast(100);
    bridge.watch(
      () => sum.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 100; i++) {
      head.write(i);
      assert(sum.read(), 1125750 - 1500 + i * 1500);
    }

    atleast.assert();
  }
}

function repeatedObservers(bridge: Bridge) {
  /** repeated observers */
  {
    let head = bridge.cell(0);
    let current = bridge.computed(() => {
      let result = 0;
      for (let i = 0; i < 1500; i++) {
        // tbh I think it's meanigless to be this big...
        result += head.read();
      }
      return result;
    });
    head.write(1);
    assert(current.read(), 1500);
    const atleast = callAtLeast(10);
    bridge.watch(
      () => current.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 10; i++) {
      head.write(i);
      assert(current.read(), i * 1500);
    }

    atleast.assert();
  }
}

function avoidablePropagation(bridge: Bridge) {
  /** avoidable change propagation  */
  {
    let head = bridge.cell(0);
    let computed1 = bridge.computed(() => head.read());
    let computed2 = bridge.computed(() => (computed1.read(), 0));
    let computed3 = bridge.computed(() => computed2.read() + 1);
    let computed4 = bridge.computed(() => computed3.read() + 2);
    let computed5 = bridge.computed(() => computed4.read() + 3);
    head.write(1);
    bridge.watch(
      () => computed5.read(),
      () => busy() // might be not called (optimization)
    );
    assert(computed5.read(), 6);
    for (let i = 0; i < 1000; i++) {
      head.write(i);
      assert(computed5.read(), 6);
    }
  }
}

function unstableObservers(bridge: Bridge) {
  /** unstable observers */
  {
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
    head.write(1);
    assert(current.read(), 20);
    const atleast = callAtLeast(100);
    bridge.watch(
      () => current.read(),
      () => atleast.call()
    );
    for (let i = 0; i < 100; i++) {
      head.write(i);
      assert(current.read(), i % 2 ? i * 2 * 10 : i * -10);
    }

    atleast.assert();
  }
}

function muxPropagation(bridge: Bridge) {
  /** mux propagaion */
  {
    let heads = new Array(100).fill(null).map((_) => bridge.cell(0));
    const mux = bridge.computed(() => {
      return Object.fromEntries(heads.map((h) => h.read()).entries());
    });
    const splited = heads
      .map((_, index) => bridge.computed(() => mux.read()[index]))
      .map((x) => bridge.computed(() => x.read() + 1));

    for (let i = 0; i < 100; i++) {
      heads[i].write(i);
      assert(splited[i].read(), i + 1);
    }
    splited.forEach((x) => {
      bridge.watch(
        () => x.read(),
        () => {}
      );
    });
    for (let i = 0; i < 100; i++) {
      heads[i].write(i * 2);
      assert(splited[i].read(), i * 2 + 1);
    }
  }
}

function assert(exp: any, value: any) {
  if (exp !== value) throw Error('Assertation failed');
}

function callAtLeast(time: number = 1) {
  let count = 0;

  return {
    call: () => {
      count++;
      if (count > time) console.log('More call than expected.');
    },
    assert: () => {
      if (count < time) {
        throw Error('Not enough call.');
      }
    },
  };
}

function busy() {
  let a = 0;
  for (let i = 0; i < 1_00; i++) {
    a++;
  }
}
