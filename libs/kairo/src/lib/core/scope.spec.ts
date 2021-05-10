import { Scope, inject, Token, provide } from './scope';

describe('core/scope', () => {
    const MockValue = {};

    const MockToken = Token.for('mock_token');

    function MockService() {
        return MockValue;
    }

    it('should work', () => {
        const scoped = new Scope(() => {
            // debugger;
            provide(MockService);
            expect(inject(MockService)).toBe(MockValue);
            provide(MockToken, MockValue);
            expect(inject(MockToken)).toBe(MockValue);
        });
    });

    it('should work hierarchically', () => {});
});
