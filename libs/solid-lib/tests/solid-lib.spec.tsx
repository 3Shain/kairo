import { TestComponent } from './TestComponent';
import { render, cleanup } from 'solid-testing-library';
import '@testing-library/jest-dom';

describe('@kairo/solid', () => {
  it('should create app', () => {
    expect(TestComponent).toBeTruthy();
    const w = render(() => <TestComponent a={1} />);
    // expect(w.container.firstChild).toHaveTextContent('12345');
    expect(w.container).toBeTruthy();
  });

  afterAll(() => {
    cleanup();
  });
});
