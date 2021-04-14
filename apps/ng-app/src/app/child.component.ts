import { Component, Input, OnInit } from '@angular/core';
import { KairoScopeRef } from '@kairo/angular';
import { Counter } from './shared';

@Component({
    template: `<ng-container *ngIf="counter$ | async; let counter">
            <p (click)="counter.plus(1)">
                child {{ counter.count }}
            </p> </ng-container
        ><ng-container *ngIf="counter$ | async; let counter">
            <p (click)="counter.plus(1)">child {{ counter.count }}</p>
        </ng-container>`,
    styles: [``],
    selector: 'rk-child-component',
})
// @WithKairo()
//  implements NgSetup<ChildComponent>
export class ChildComponent {
    @Input()
    test: string;

    constructor(private scope: KairoScopeRef) {}

    counter$ = this.scope.useInject(Counter);

    // count: number;

    // ngSetup(
    //     useProp: <P>(thunk: (instance: ChildComponent) => P) => Behavior<P>
    // ): object {
    //     const testprop = useProp((x) => x.test);

    //     const { count } = inject(Counter);

    //     testprop.watch(console.log);
    //     return {
    //         count
    //     };
    // }
}
