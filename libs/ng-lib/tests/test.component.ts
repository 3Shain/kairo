import { Component } from '@angular/core';
import { mut } from 'kairo';
import { ngSetup, WithKairo } from '../src';

@WithKairo()
@Component({
  selector: 'test-component',
  template: `<div>{{ count }}</div>`,
})
export class TestComponent extends ngSetup(() => {
  const [count, setCount] = mut(12345);
  return {
    count,
    setCount,
  };
}) {}
