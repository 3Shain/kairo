import {
  Context,
  injected,
  Identifier,
  reduceConcerns,
  IdentifierNotFoundError,
  Concern,
} from './context';

describe('context', () => {
  const TOKEN = Identifier.of<{}>('Test token.');
  const VALUE = {};

  const TOKEN2 = Identifier.of<number>('Token 2');
  const VALUE2 = 1;

  const TOKEN3 = Identifier.of<never>('Token 3');

  const testConcern1: Concern = () => {
    return {
      [TOKEN]: VALUE,
    };
  };

  function testConcern2() {
    return {
      [TOKEN2]: VALUE2,
    };
  }

  function testConcern3() {
    const value = injected(TOKEN3);
  }

  const testConcern4 = reduceConcerns([testConcern1, testConcern2]);

  const testConcern5 = reduceConcerns([testConcern1, testConcern3]);

  it('should build a context', () => {
    const context = new Context().build(testConcern1);
    expect(context.get(TOKEN)).toStrictEqual(VALUE);
  });

  it('should reduce multiple concern', () => {
    const context = new Context().build(testConcern4);
    expect(context.get(TOKEN)).toStrictEqual(VALUE);
    expect(context.get(TOKEN2)).toStrictEqual(VALUE2);
  });

  it('should throw if not found', () => {
    expect(() => {
      new Context().build(testConcern3);
    }).toThrow(IdentifierNotFoundError);
  });

  it('should throw if not found', () => {
    expect(() => {
      new Context().build(testConcern5);
    }).toThrow(IdentifierNotFoundError);
  });
});
