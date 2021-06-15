import { render } from '@testing-library/svelte';
import TestComponent from './TestComponent.svelte';

describe('@kairo/svelte', () => {
  it('should create the app', () => {
    const result = render(TestComponent);
    expect(result.container.firstChild.textContent).toEqual('12345');
  });
});
