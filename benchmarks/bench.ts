import { Suite } from 'benchmark';
import { avoidablePropagation } from './cases/avoidable';
import { broadPropagation } from './cases/broad';
import { deepPropagation } from './cases/deep';
import { diamond } from './cases/diamond';
import { mux } from './cases/mux';
import { repeatedObservers } from './cases/repeated';
import { triangle } from './cases/triangle';
import { unstable } from './cases/unstable';
import {
  Bridge,
  KairoBridge,
  KairoInternal,
  MobxBridge,
  ReadableCell,
  SBridge,
  SolidBridge,
  Case,
  VueScheduledBridge,
} from './common';

declare global {
  const __DEV__: boolean;
  const __TEST__: boolean;
}

(global as any).__DEV__ = false;
(global as any).__TEST__ = false;

function doTest(test: Case) {
  const suite = new Suite(test.name);
  console.log('Item: ' + test.name);

  function addBridge(name: string, bridge: Bridge) {
    bridge.root(() => {
      const iter = test(bridge);
      suite.add(name, () =>
        bridge.root(() => {
          iter();
        })
      );
    });
  }

  addBridge('kairo', KairoBridge);
  // addBridge('S.js', SBridge);
  addBridge('kairo internal', KairoInternal);
  // addBridge('mobx', MobxBridge);
  // addBridge('solid', SolidBridge);
  // addBridge('vue (scheduled)', VueScheduledBridge as Bridge);

  suite
    .on('error', (e) => {
      console.log(e.target.error);
    })
    .on('cycle', (s) => {
      console.log(String(s.target));
      // console.log(JSON.stringify(s.target.stats));
      // global.gc();
    })
    .run({
      async: false
    })
    .on('complete', () => {});
}

doTest(deepPropagation);
doTest(broadPropagation);
doTest(diamond);
doTest(triangle);
doTest(mux);
doTest(repeatedObservers);
doTest(unstable);
doTest(avoidablePropagation);
