import { lifecycle, LifecycleScope, collectScope } from './lifecycle-scope';
import { noop } from './misc';

describe('lifecycle-scope', () => {
  it('should work', () => {
    const endCollectScope = collectScope();
    let state = 0;
    lifecycle(() => {
      state = 1;
      return () => {
        state = 2;
      };
    });
    const scope = endCollectScope();
    expect(state).toBe(0);
    const detach = scope.attach();
    expect(state).toBe(1);
    detach();
    expect(state).toBe(2);
  });

  it('should throw error if not in scope', () => {
    expect(() => {
      lifecycle(noop);
    }).toThrow(TypeError('Not inside a scope'));
  });

  it('should throw error if escape outer scope first before escape inner scope', () => {
    const outerScope = collectScope();
    const innerScope = collectScope();
    expect(outerScope).toThrow();
    innerScope();
  });
});
