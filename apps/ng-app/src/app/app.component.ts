import { Component } from '@angular/core';
import { ngSetup, WithKairo } from '@kairo/angular';
import { computed, delay, effect, provide, race, stream, task } from 'kairo';
import { Counter } from './shared';

@Component({
    selector: 'realkairo-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
})
@WithKairo()
export class AppComponent extends ngSetup((props: any, useProp) => {
    const doubled = computed(() => {
        return count.value * 2;
    });
    const { count, plus } = provide(Counter);

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
    };
}) {}

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
