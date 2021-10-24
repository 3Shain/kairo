import { testBed } from './debug';
import { race, delay, task, ControlStatements as s } from './concurrency';
import { stream } from './stream';
import { lifecycle } from './lifecycle-scope';

function useKonami(keys: string[], timeout: number) {
  const [keydownCode, onkeydown] = stream<string>();
  const [effects, doEffects] = stream<boolean>();

  const activate = ()=>doEffects(true);
  const fail = ()=>doEffects(false);

  const loop = task(function* () {
    while (true) {
      const key = yield* keydownCode;
      if (key == keys[0]) {
        const keysRemain = keys.slice(1);
        yield* s.while(
          () => keysRemain.length > 0,
          function* () {
            yield* s.select
              .case(keydownCode, function* (next) {
                if (next !== keysRemain.shift()) {
                  fail();
                  yield* s.break();
                }
                if (keysRemain.length == 0) {
                  activate();
                }
              })
              .case(delay(timeout), function* () {
                fail();
                yield* s.break();
              });
          }
        );
      }
    }
  });
  lifecycle(loop);

  return {
    onkeydown,
    effects,
  };
}

describe('debug', () => {
  it('konami code', () => {
    return testBed((interact) => {
      const { onkeydown, effects } = useKonami(['a', 'a', 'b', 'b'], 1000);

      return interact(function* () {
        onkeydown('a');
        onkeydown('a');
        onkeydown('a'); // fail: wrong key
        onkeydown('a');
        yield* delay(1100); // fail: timeout
        onkeydown('a');
        yield* delay(100);
        onkeydown('a');
        onkeydown('b');
        yield* delay(100);
        onkeydown('a'); //fail: wrong key
        onkeydown('a');
        onkeydown('a');
        yield* delay(100);
        onkeydown('b');
        onkeydown('b'); //success
      }).expectEffects(function* () {
        expect(yield* effects).toBeFalsy();
        expect(yield* effects).toBeFalsy();
        expect(yield* effects).toBeFalsy();
        expect(yield* effects).toBeTruthy();
      });
    });
  });
});
