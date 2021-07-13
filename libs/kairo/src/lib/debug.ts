import { RunnableGenerator, start } from './concurrency';
import { Scope } from './scope';

export function testBed<Bindings>(
  setup: (interact: typeof interactFn) => Promise<void>
) {
  const testScope = new Scope();

  const endScope = testScope.beginScope();

  const binding = setup(interactFn);

  endScope();

  return binding;
}

function interactFn(interactLogic: () => RunnableGenerator<void>) {
  return {
    async expectEffects(runnable: () => RunnableGenerator<void>) {
      const detach = Scope.current.attach();

      const expect = start(runnable()); // do side effects first
      start(interactLogic()); // start interact
      await expect;
      detach();
    },
  };
}
