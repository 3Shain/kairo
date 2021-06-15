import { TestBed } from '@angular/core/testing';
import { TestComponent, TestDirective } from './test.component';
import { KairoModule } from '../src';

describe('@kairo/angular', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestComponent, TestDirective],
      imports: [],
    }).compileComponents();
  });

  it('should create the component and directive with no error', () => {
    const fixture = TestBed.createComponent(TestComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    const compiled = fixture.nativeElement;
    fixture.detectChanges();
    expect(
      compiled.querySelector('div').classList.contains('test-class')
    ).toBeTruthy();
  });

  it('should work with change detection', () => {
    const fixture = TestBed.createComponent(TestComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('div').textContent).toEqual('12345');
    app.setCount(54321);
    fixture.detectChanges();
    expect(compiled.querySelector('div').textContent).toEqual('54321');
  });
});
