import {
    createScope,
    inject,
    InjectToken,
    provide
} from './scope';

describe('core/scope', () => {

    const MockValue = {};

    const MockToken = new InjectToken("mock_token");

    function MockService() {
        return MockValue;
    }

    it('should work', () => {
        const scoped = createScope(() => {
            // debugger;
            provide(MockService);
            expect(inject(MockService)).toBe(MockValue);
            provide(MockToken,MockValue);
            expect(inject(MockToken)).toBe(MockValue);
        })
    });

    it('should work hierarchically', () => {

    });
})