import { Suite } from 'benchmark';
import {
    Bridge,
    KairoBridge,
    KairoInternal,
    MobxBridge,
    ReadableCell,
    SBridge,
    VueReactiveBridge,
} from './common';

declare global {
    const __DEV__: boolean;
    const __TEST__: boolean;
}

let results = [];

(global as any).__DEV__ = false;
(global as any).__TEST__ = false;
const suite = new Suite('reactive');
suite
    .add(`Vue`, () => {
        ReactiveTest(VueReactiveBridge);
    })
    .add(`MobX`, () => {
        ReactiveTest(MobxBridge);
    })
    .add(`Kairo`, () => {
        ReactiveTest(KairoInternal);
    })
    .add(`S.js`, () => {
        ReactiveTest(SBridge);
    })
    .on('error', (e) => {
        console.log(e.target.error);
    })
    .on('cycle', (s) => {
        // console.log(String(s.target));
        results.push(String(s.target));
        global.gc();
    })
    .run({
        async: true,
    })
    .on('complete', () => {
        results.forEach((s) => {
            console.log(s);
        });
    });

function ReactiveTest(bridge: Bridge) {
    bridge.root(() => {
        /** deep propagation */
        {
            let head = bridge.cell(0);
            let current = head as ReadableCell<number>;
            for (let i = 0; i < 1500; i++) {
                let c = current;
                current = bridge.computed(() => {
                    return c.read() + 1;
                });
            }
            head.write(1);
            bridge.watch(
                () => current.read(),
                () => {}
            );
            for (let i = 0; i < 100; i++) {
                head.write(i);
                assert(current.read(), 1500 + i);
            }
        }

        /** broad propagation */
        {
            let head2 = bridge.cell(0);
            let current2 = head2 as ReadableCell<number>;
            for (let i = 0; i < 2000; i++) {
                current2 = bridge.computed(() => {
                    return head2.read() + i;
                });
            }
            head2.write(1);
            bridge.watch(
                () => current2.read(),
                () => {}
            );
            for (let i = 0; i < 100; i++) {
                head2.write(i);
                assert(current2.read(), i + 1999);
            }
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
            bridge.watch(
                () => sum.read(),
                () => {}
            );
            for (let i = 0; i < 100; i++) {
                head.write(i);
                assert(sum.read(), (i + 1) * 1500);
            }
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
            const atleast = callAtLeast();
            bridge.watch(
                () => sum.read(),
                () => atleast.call()
            );
            head.write(2);
            assert(sum.read(), 1127250);

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
            // TBD
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
            // assert(current.read(), 1500);
            const atleast = callAtLeast(10);
            bridge.watch(
                () => current.read(),
                () => atleast.call()
            );
            for (let i = 0; i < 10; i++) {
                head.write(i);
                // assert(current.read(), i * 1500);
            }

            // atleast.assert();
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
            if (count > time) console.log('llll');
        },
        assert: () => {
            if (count < time) {
                console.log('Assertation failed');
            }
        },
    };
}
