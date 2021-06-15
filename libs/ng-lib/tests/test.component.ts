import { Component, Directive, ElementRef, Renderer2 } from '@angular/core';
import { effect, mut } from 'kairo';
import { ngSetup, WithKairo } from '../src';

@WithKairo()
@Component({
  selector: 'test-component',
  template: `<div testDir>{{ count }}</div>`,
})
export class TestComponent extends ngSetup(() => {
  const [count, setCount] = mut(12345);
  return {
    count,
    setCount,
  };
}) {}

@WithKairo()
@Directive({
  selector: '*[testDir]',
})
export class TestDirective extends ngSetup(
  (dir: { element: ElementRef; render: Renderer2 }) => {
    effect(() => {
      dir.render.addClass(dir.element.nativeElement, 'test-class');
    });
  }
) {
  constructor(private element: ElementRef, private render: Renderer2) {
    super();
  }
}
