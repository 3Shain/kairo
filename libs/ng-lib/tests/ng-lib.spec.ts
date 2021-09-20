import { TestBed } from '@angular/core/testing';
import { ngSetup, WithKairo, ngElementRef, provideConcerns } from '../src';
import {
  Component,
  ElementRef,
  Input,
  NO_ERRORS_SCHEMA,
  ViewChild,
} from '@angular/core';
import { mut, lifecycle, computed, effect } from 'kairo';
import '@testing-library/jest-dom';
import { fireEvent } from '@testing-library/dom';
import { KairoScopeRefImpl } from '../src/lib/kairo.service';

describe('@kairo/angular', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [Case1Wrapper, Case1, Case1Child],
      imports: [],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('implement Simple Component Model', () => {
    const fixture = TestBed.createComponent(Case1Wrapper);
    const app = fixture.componentInstance;

    const compiled = fixture.nativeElement;

    const initCallback = jest.fn();
    const cleanCallback = jest.fn();
    const viewpropChangedCallback = jest.fn();

    app.initialize = initCallback;
    app.clean = cleanCallback;
    app.viewProp = 'Hello';
    app.viewPropChanged = viewpropChangedCallback;

    fixture.detectChanges();

    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(0);

    const button = compiled.querySelector('button');
    const span = compiled.querySelector('span');
    expect(compiled.querySelector('p')).toHaveTextContent('Hello');
    expect(button).toHaveTextContent('0');

    app.viewProp = 'World';
    fixture.detectChanges();
    expect(viewpropChangedCallback).toBeCalledTimes(2);
    expect(compiled.querySelector('p')).toHaveTextContent('World');

    app.viewProp = 'Kairo';
    fixture.detectChanges();
    expect(viewpropChangedCallback).toBeCalledTimes(3);
    expect(compiled.querySelector('p')).toHaveTextContent('Kairo');

    fireEvent.click(button, {});
    fixture.detectChanges();
    expect(button).toHaveTextContent('1');
    expect(span).toHaveTextContent('2');
    fireEvent.click(button, {});
    fixture.detectChanges();
    expect(button).toHaveTextContent('2');
    expect(span).toHaveTextContent('4');

    fixture.destroy();
    expect(initCallback).toBeCalledTimes(1);
    expect(cleanCallback).toBeCalledTimes(1);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
});

/**
 * 3Shain: how could I disable the annoying ngtsc errors?
 */

@Component({
  selector: 'case1-wrapper',
  template: `<case1
    [initialize]="initialize"
    [clean]="clean"
    [viewProp]="viewProp"
    [viewPropChanged]="viewPropChanged"
  ></case1>`,
})
export class Case1Wrapper {
  @Input()
  initialize: Function;

  @Input()
  clean: Function;

  @Input()
  viewProp: string;

  @Input()
  viewPropChanged: Function;
}

@WithKairo()
@Component({
  selector: 'case1',
  providers: [
    provideConcerns([()=>{
    }])
  ],
  template: `<p #para>{{ viewProp }}</p>
    <button (click)="onClick()">{{ count }}</button>
    <case1-child [count]="doubled"></case1-child>`,
})
export class Case1 extends ngSetup(
  (
    prop: {
      initialize: Function;
      clean: Function;
      viewProp: string;
      viewPropChanged: Function;
    },
    useProp
  ) => {
    const para = ngElementRef<HTMLParagraphElement>(null);

    lifecycle(() => {
      prop.initialize();
      expect(para.current).toBeInTheDocument();

      return () => {
        prop.clean();
      };
    });

    const viewProp = useProp((x) => x.viewProp);
    effect(()=>{
      viewProp.value;
      prop.viewPropChanged();
    });

    const [count, setCount] = mut(0);

    const doubled = computed(()=>count.value * 2);

    return {
      count,
      doubled,
      para,
      onClick: () => {
        setCount(count.value + 1);
      },
    };
  }
) {
  @Input()
  initialize: Function;

  @Input()
  clean: Function;

  @Input()
  viewProp: string;

  @Input()
  viewPropChanged: Function;

  @ViewChild('para')
  para: ElementRef;
}

@WithKairo()
@Component({
  selector: 'case1-child',
  template: `<span>{{ dp }}</span>`,
})
export class Case1Child extends ngSetup(
  (
    _: {
      count: number;
    },
    useProp
  ) => {
    const dp = useProp((x) => x.count);

    return {
      dp,
    };
  }
) {
  @Input()
  count: number;
}