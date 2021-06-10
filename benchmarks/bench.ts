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
const suite = new Suite('reactive');
suite
    .add(`Solid`, () => {
        ReactiveTest(SolidBridge);
    })
    .add(`Vue`, () => {
        ReactiveTest(VueReactiveBridge);
    })
    .add(`MobX`, () => {
        ReactiveTest(MobxBridge);
    })
    .add(`Kairo`, () => {
        ReactiveTest(KairoBridge);
    })
    .add(`S.js`, () => {
        ReactiveTest(SBridge);
    })
    .on('error', (e) => {
        console.log(e.target.error);
    })
    .on('cycle', (s) => {
        console.log(String(s.target));
        global.gc();
    })
    .run({
        async: true,
    })
    .on('complete', () => {});

function ReactiveTest(bridge: Bridge) {
    bridge.root(() => {
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

        /** broad propagation */
        {
            let head = bridge.cell(0);
            let current = head as ReadableCell<number>;
            for (let i = 0; i < 2000; i++) {
                current = bridge.computed(() => {
                    return head.read() + i;
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
                assert(current.read(), i + 1999);
            }
            atleast.assert();
        }

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

        /** repeated observers */
        {
            let head = bridge.cell(0);
            let current = bridge.computed(() => {
                let result = 0;
                for (let i = 0; i < 1500; i++) {
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
                () => {} // might be not called (optimization)
            );
            assert(computed5.read(), 6);
            for (let i = 0; i < 100; i++) {
                head.write(i);
                assert(computed5.read(), 6);
            }
        }

        /** unstable observers */
        {
            let head = bridge.cell(0);
            const double = bridge.computed(() => head.read() * 2);
            const inverse = bridge.computed(() => -head.read());
            let current = bridge.computed(() => {
                let result = 0;
                for (let i = 0; i < 1500; i++) {
                    result += head.read() % 2 ? double.read() : inverse.read();
                }
                return result;
            });
            head.write(1);
            assert(current.read(), 3000);
            const atleast = callAtLeast(10);
            bridge.watch(
                () => current.read(),
                () => atleast.call()
            );
            for (let i = 0; i < 10; i++) {
                head.write(i);
                assert(current.read(), i % 2 ? i * 2 * 1500 : i * -1500);
            }

            atleast.assert();
        }

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
    });
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
