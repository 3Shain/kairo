import { EffectScope } from "kairo";

export function createTestHarness<Model>(test: () => Model) {
  return new TestHarness<Model>(test);
}

class TestHarness<Model> {
  constructor(private test: () => Model) {}

  withConcern() {
    return new TestHarness(this.test);
  }

  withContext() {
    return new TestHarness(this.test);
  }

  withInjection() {
    return new TestHarness(this.test);
  }

  shell(
    program: (
      model: Model,
      controls: {
        commitEffect: () => void;
        startEffect: () => void;
        stopEffect: () => void;
      }
    ) => void | Promise<void>
  ) {

    return async function testHarness() {
        const s = new EffectScope({
            schedule: ()=>{}
        });
        // const c = new
    };
  }
}
