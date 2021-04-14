import { Component, Input } from '@angular/core';
import { NgSetup, WithKairo } from '@kairo/angular';
import { Behavior, inject } from 'kairo';
import { Counter } from './shared';

@Component({
    template: `<p>child {{count}}</p>`,
    styles: [``],
    selector: 'rk-child-component',
})
@WithKairo()
export class ChildComponent implements NgSetup<ChildComponent> {
    @Input()
    test: string;

    count: number;

    ngSetup(
        useProp: <P>(thunk: (instance: ChildComponent) => P) => Behavior<P>
    ): object {
        const testprop = useProp((x) => x.test);

        const { count } = inject(Counter);

        testprop.watch(console.log);
        return {
            count
        };
    }
}
