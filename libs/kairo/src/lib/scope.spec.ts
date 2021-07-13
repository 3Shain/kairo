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

  it('should work hierarchically', () => {
    const rootScope = new Scope();
    const endRootScope = rootScope.beginScope();
    provide(MockService);
    provide(MockToken, MockValue);
    endRootScope();

    const parentScope = new Scope(undefined,rootScope);
    const endParentScope = parentScope.beginScope();
    expect(inject(MockService)).toBe(MockValue);
    const parentProvided = {a:1};
    provide(MockToken,parentProvided);
    expect(inject(MockToken)).toBe(parentProvided);
    expect(inject(MockToken, {skipSelf: true})).toBe(MockValue);
    endParentScope();

    const childScope = new Scope(parentScope);
    const endChildScope = childScope.beginScope();
    expect(inject(MockToken)).toBe(parentProvided);
    endChildScope();
  });

  // it('',()=>{

  // })
});
