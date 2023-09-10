import {
  ConcernOf,
  ImplementationOf,
  BrandOf,
  AnyConcern,
  AnyImplementation,
  PropsOf,
  ImplementedConcernOf,
  DependenciesOf,
} from './concern';

interface ModuleInstance {
  init(): void;
  destroy(): void;
  get<Brand extends string, Type>(concern: ConcernOf<Brand, Type>): Type;
}

export class Module<Props, Imports, Exports> {
  /** @internal */
  constructor(
    private concerns: ImplementationOf<any, any, any>[],
    private dprops: any
  ) {}

  add<Implementation extends AnyImplementation>(impl: Implementation) {
    type ImplementedConcern = ImplementedConcernOf<Implementation>;
    type Dependencies = DependenciesOf<Implementation>;
    return new Module<
      Props & PropsOf<Implementation>,
      Exclude<Imports, ImplementedConcern> | Dependencies,
      Exports | ImplementedConcern
    >([...this.concerns, impl], this.dprops);
  }

  build: ReadyForConstruct<Module<Props, Imports, Exports>, () => {}, never> =
    (() => this.buildWithContext({} as any, {} as any)) as any;

  buildWithContext(
    props: Props,
    vtx: { [key in keyof BrandOf<Imports>]: any }
  ): {} {
    const context = { ...vtx };
    for (const impl of this.concerns) {
      impl.construct(props);
    }
    return {
      get(concern: AnyConcern) {
        if (concern.brand in context) {
          return context[concern.brand];
        }
        throw new Error('Not found');
      },
    } as any;
  }

  withProps<T extends Partial<Props>>(props: T) {
    return new Module<Exclude<Props, T>, Imports, Exports>([...this.concerns], {
      ...this.dprops,
      ...props,
    });
  }

  addModule<Props, Deps, P>(module: Module<Props, Deps, P>) {
    return new Module<
      Props & Props,
      Imports | Exclude<Deps, Exports>,
      Exports | P
    >([...this.concerns, ...module.concerns], this.dprops);
  }
}

type ReadyForConstruct<T, L, R> = T extends Module<infer Props, infer Deps, any>
  ? {} extends Props
    ? [Deps] extends [never]
      ? L
      : R
    : R
  : never;

export function createModule<FinalModule>(
  factory: (a: Module<{}, never, never>) => FinalModule
) {
  return factory(new Module<{}, never, never>([], {}));
}

export type { ReadyForConstruct };
