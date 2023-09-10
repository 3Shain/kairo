import { ConcernOf, BrandOf } from "./concern";

function createTestHarness<Deps, Model>(
  target: () => Generator<Deps, Model, never>
) {
  return new TestHarness(target, {});
}

type Shell<Model, Context extends { [key: string]: any }> = (
  shellProgram: (model: Model, ctx: Context) => void | Promise<void>
) => void | Promise<void>;

class TestHarness<
  Deps,
  Model,
  Context extends { [key: string]: any }
> {
  constructor(
    private target: () => Generator<Deps, Model, never>,
    private context: Context
  ) {}

  withDependencyFactory<B extends string, T, V extends T>(
    concern: ConcernOf<B, T>,
    factory: () => V
  ) {
    return new TestHarness<
    Exclude<Deps, ConcernOf<B,T>>
    ,Model,any>(this.target as any, {
      ...this.context,
      [concern.brand]: factory(),
    });
  }

  withDependency<B extends string, T, V extends T>(
    concern: ConcernOf<B, T>,
    t: V
  ) {
    return new TestHarness(this.target, {
      ...this.context,
      [concern.brand]: t,
    });
  }

  shell: [Deps] extends [never]
    ? Shell<
        Model,
        {
          [T in BrandOf<Deps>]: Context[T];
        }
      >
    : never= ((program: Shell<any, any>) => {}) as any;
}

export { createTestHarness };
