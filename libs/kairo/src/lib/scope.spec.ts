import { Scope, inject, Token, provide } from './scope';

describe('scope', () => {
  const MockValue = {};

  const MockToken = Token.for('mock_token');

  function MockService() {
    return MockValue;
  }

  it('should work', () => {
    const scoped = new Scope();
    const endScope = scoped.beginScope();
    provide(MockService);
    expect(inject(MockService)).toBe(MockValue);
    provide(MockToken, MockValue);
    expect(inject(MockToken)).toBe(MockValue);
    endScope();
  });

  it('should work hierarchically', () => {});
});
