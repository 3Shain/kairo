import { HttpClient } from '@angular/common/http';
import { Component, Input } from '@angular/core';
import { WithKairo } from '@kairo/angular';
import { Action, computed, stream, task, resolve as $, Behavior } from 'kairo';

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
    /** Above is stub.... */

    ngSetup(inputs: { input: Behavior<string> }) {
        const http = this.http;
        const [plusEvent, plus] = stream<number>();

        const count = plusEvent.reduce((a, b) => {
            return a + b;
        }, 0);

        const doubled = computed(() => {
            return count.value * 2;
        });

        const theTask = task(function* (this: any) {
            console.log('task start!');
            const text = yield* $(http.get('https://api.github.com'));
            console.log(text);

            for (let i = 0; i < 10; i++) {

                console.log(`one event! ${yield* plusEvent}`);
            }
            console.log('task end!');
        });

        theTask(); // immediate start task.

        return {
            plus: () => plus(1),
            minus: () => plus(-1),
            count,
            doubled
        };
    }

    title = 'ng-app';

    constructor(private http: HttpClient) { }
}
