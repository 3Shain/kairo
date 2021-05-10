import { HttpClient } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { WithKairo } from '@kairo/angular';
import {
    Action,
    computed,
    stream,
    task,
    resolve as $,
    Behavior,
    delay,
    race,
    provide,
    effect,
} from 'kairo';
import { Counter } from './shared';

@Component({
    selector: 'realkairo-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
@WithKairo()
export class AppComponent {
    @Input()
    input: string;

    plus: Action<void>;
    minus: Action<void>;
    theTask: Action<void>;
    count: number;
    doubled: number;
    msg: string;
    /** Above is stub.... */

    ngSetup(inputs: { input: Behavior<string> }) {
        const http = this.http;
        // const [plusEvent, plus] = stream<number>();

        // const count = plusEvent.reduce((a, b) => {
        //     return a + b;
        // }, 0);

        const doubled = computed(() => {
            return count.value * 2;
        });

        const { count, plus } = provide(Counter);

        // const theTask = switchedTask(function* (this: any) {
        //     console.log('task start!');
        //     const text = yield* $(http.get('https://api.github.com'));
        //     console.log(text);
        //     // for (let i = 0; i < 10; i++) {
        //     //     console.log(`one event! ${yield* plusEvent}`);
        //     // }
        //     // console.log('task end!');
        // });

        // const theTask1 = lockedTask(
        //     function* () {
        //         try {
        //             console.log('start!');
        //             yield* delay(1000);
        //             console.log('stop!');
        //         } catch (e) {
        //             if (e === DISPOSED) {
        //                 console.log('canceled!');
        //             }
        //         }
        //     },
        //     {
        //         maxConcurrency: 3,
        //         throwThanWait: true,
        //     }
        // );

        useKonami([
            'ArrowUp',
            'ArrowUp',
            'ArrowDown',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'ArrowLeft',
            'ArrowRight',
        ]);

        return {
            plus: () => plus(1),
            minus: () => plus(-1),
            count,
            doubled,
            msg: doubled.map((x) => String(x)),
            // theTask,
        };
    }

    title = 'ng-app';

    constructor(private http: HttpClient) {}
}

function useKonami(keys: string[]) {
    const [keyevent, emitkey] = stream<KeyboardEvent>();

    const keydown = keyevent.transform((x) => x.code);

    const startTask = task(function* () {
        while (true) {
            const key = yield* keydown;
            if (key == keys[0]) {
                console.log('start');
                const keysRemain = keys.slice(1).reverse();
                while (keysRemain.length) {
                    const next = yield* race([keydown, delay(1000)]);
                    if (next !== keysRemain.pop()) {
                        console.log('failed');
                        break;
                    }
                    if (keysRemain.length == 0) {
                        console.log('activated!');
                    }
                }
            }
        }
    });

    effect(() => startTask());

    effect(() => {
        window.addEventListener('keydown', emitkey);
        return () => window.removeEventListener('keydown', emitkey);
    });
}
