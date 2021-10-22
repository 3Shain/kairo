import { RunnableGenerator, task } from './concurrency';
import { Concern, Context } from './context';
import { collectScope, LifecycleScope } from './lifecycle-scope';

export function testBed(
  setup: (interact: ReturnType<typeof createInteractionLogic>) => Promise<void>,
  concern?: Concern
) {
  const exitScope = collectScope();
  concern && new Context().build(concern);
  const binding = setup(createInteractionLogic(exitScope));
  return binding;
}

function createInteractionLogic(exitScope: ()=>LifecycleScope) {
  return function interactFn(interactLogic: () => RunnableGenerator<void>) {
    return {
      expectEffects(runnable: () => RunnableGenerator<void>) {
        const scope = exitScope();
        const detach = scope.attach();

        const expect = task(runnable)(); // do side effects first
        task(interactLogic)(); // start interact
        return expect.finally(detach);
      },
    };
  };
}
