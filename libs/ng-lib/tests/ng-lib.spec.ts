import { TestBed } from '@angular/core/testing';
import { TestComponent } from './test.component';
import { KairoModule } from '../src';

describe('@kairo/angular', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestComponent],
      imports: [KairoModule.forRoot()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(TestComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(TestComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    const compiled = fixture.nativeElement;
    expect(compiled.querySelector('div').textContent).toEqual('12345');
    app.setCount(54321);
    fixture.detectChanges();
    expect(compiled.querySelector('div').textContent).toEqual('54321');
  });

  it('should render title2', () => {
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
