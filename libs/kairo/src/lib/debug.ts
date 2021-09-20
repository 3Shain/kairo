import { RunnableGenerator, start } from './concurrency';
import { Concern, Context } from './context';
import { collectScope, LifecycleScope } from './lifecycle-scope';

export function testBed(
  setup: (interact: ReturnType<typeof createInteractionLogic>) => Promise<void>,
  concern?: Concern
) {
  const exitScope = collectScope();
  concern && new Context().build(concern);
  const binding = setup(createInteractionLogic(exitScope()));
  return binding;
}

function createInteractionLogic(scope: LifecycleScope) {
  return function interactFn(interactLogic: () => RunnableGenerator<void>) {
    return {
      expectEffects(runnable: () => RunnableGenerator<void>) {
        const detach = scope.attach();

        const expect = start(runnable()); // do side effects first
        start(interactLogic()); // start interact
        return expect.finally(detach);
      },
    };
  };
}
