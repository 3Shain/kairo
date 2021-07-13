import { testBed } from './debug';

import { race, delay, task } from './concurrency';
import { stream } from './stream';
import { mount } from './scope';

function useKonami(keys: string[], timeout: number) {
  const [keydownCode, onkeydown] = stream<string>();
  const [effects, doEffects] = stream<boolean>();

  const loop = task(function* () {
    while (true) {
      const key = yield* keydownCode;
      if (key == keys[0]) {
        const keysRemain = keys.slice(1).reverse();
        while (keysRemain.length) {
          const next = yield* race([keydownCode, delay(timeout)]);
          if (next !== keysRemain.pop()) {
            doEffects(false);
            break;
          }
          if (keysRemain.length == 0) {
            doEffects(true);
          }
        }
      }
    }
  });
  mount(() => loop());

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
