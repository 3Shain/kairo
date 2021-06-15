import { Component, Input, OnInit } from '@angular/core';
import { ngSetup, ScopeRef, WithKairo } from '@kairo/angular';
import { effect, inject } from 'kairo';
import { Counter } from './shared';

@Component({
  template: `<p>current count: {{ testprop }}</p>`,
  styles: [``],
  selector: 'rk-child-component',
})
@WithKairo()
//  implements NgSetup<ChildComponent>
export class ChildComponent extends ngSetup(
  (
    _: {
      test: string;
    },
    useProp
  ) => {
    const testprop = useProp((x) => x.test);

    const { count } = inject(Counter);

    effect(() => testprop.watch(console.log));
    return {
      count,
      testprop,
    };
  }
) {
  @Input()
  test: string;
}
