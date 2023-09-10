// copied from https://stackoverflow.com/a/70731144/15253774
type UnUnion<T, S> = T extends S ? ([S] extends [T] ? T : never) : never;
type NotUnion<T> = UnUnion<T, T>;
type TrueStringLiteral<T extends string> = string extends T
  ? never
  : NotUnion<T>;
type Exact<T, I> = T extends I
  ? Exclude<keyof T, keyof I> extends never
    ? T
    : never
  : never;

type ConcernOf<Brand extends string, Interface> = {
  readonly brand: Brand;
  <
    Yields extends AnyImplementationFeatures,
    Props extends {},
    Return extends Interface
  >(
    implementation: (props: Props) => Generator<Yields, Return>
  ): ImplementationOf<Brand, Yields, Props, Return>;
  [Symbol.iterator]: () => Generator<DependsOn<Brand>, Interface>;
};

type DependsOn<Brand extends string> = {
  feature: 'injection';
  brand: Brand;
};

type AnyImplementationFeatures = { feature: string };

type AnyConcern = ConcernOf<string, any>;

type BrandOf<TConcern> = TConcern extends ConcernOf<infer Brand, any>
  ? Brand
  : never;

type InterfaceOf<TConcern> = TConcern extends ConcernOf<any, infer Interface>
  ? Interface
  : never;

class ImplementationOf<
  Brand extends string,
  Features extends AnyImplementationFeatures,
  Props extends {},
  Interface
> {
  constructor(
    public readonly brand: Brand,
    public readonly __factory__: (
      props: Props
    ) => Generator<Features, Interface>
  ) {}

  pipe() {}

  withProps<T extends {}>(props: T) {
    return new ImplementationOf<
      Brand,
      Features,
      StripProps<Props, T>,
      Interface
    >(
      this.brand,
      (_props) => this.__factory__({ ...props, ..._props } as any) //TODO: fix any
    );
  }

  withPropsFactory<T extends {}>(
    propsFactory: (f: T) => Props
  ): (props: T) => ImplementationOf<Brand, Features, {}, Interface> {
    return (x: T) => this.withProps(propsFactory(x)) as any; //TODO: fix any Strip<X,X> should be {}
  }

  _provide<T extends (AnyImplementation | ((x: any) => AnyImplementation))[]>(
    ...args: T
  ): GenProvidedImp<Brand, Features, Props, Interface, T> {
    return new ImplementationOf<Brand, Features, Props, Interface>(
      this.brand,
      this.__factory__
    ) as any; // TODO : fix type;
  }

  provide<
    TConcern extends string,
    TFeatures extends AnyImplementationFeatures,
    TInterface,
    TProps extends {},
    TMProps extends {}
  >(
    impl:
      | ImplementationOf<TConcern, TFeatures, Exact<TProps, {}>, TInterface>
      | ((
          props: TMProps
        ) => ImplementationOf<
          TConcern,
          TFeatures,
          Exact<TProps, {}>,
          TInterface
        >)
  ) {
    return new ImplementationOf(this.brand, (props: Props & TMProps) =>
      createSyncHandler('injection', function* (x:DependsOn<string>) {
        const context = yield {feature:'injection'} as Extract<DependenciesOfFeature<Features>,DependsOn<TConcern>>;
        const _impl = (typeof impl==='function' ? impl(props): impl);
        const pp = yield* _impl.__factory__({} as any); // TODO: fix any
        return {
          ...(context as object),
          [_impl.brand]: pp
        };
      })(this.__factory__(props))
    ); // TODO: fix any
  }
}

type NiladicImplementationOf<
  Brand extends string,
  Features extends AnyImplementationFeatures,
  Interface
> = ImplementationOf<Brand, Features, {}, Interface>;

type StripProps<T, U> = T extends U ? {} : T;

type UnmatchedConcernInterface<A, B> = {
  expected: A;
  actual: B;
};

type SafeStrip<
  Deps extends AnyImplementationFeatures,
  Target extends string
> = Deps extends DependsOn<string>
  ? Deps['brand'] extends Target
    ? never
    : Deps
  : never;

type AnyImplementation = ImplementationOf<
  string,
  AnyImplementationFeatures,
  {},
  any
>;

type PropsOf<TImplementation> = TImplementation extends ImplementationOf<
  string,
  AnyImplementationFeatures,
  infer Props,
  any
>
  ? Props
  : never;

type ImplementedConcernOf<TImplementation> =
  TImplementation extends ImplementationOf<
    infer IConcern,
    AnyImplementationFeatures,
    {},
    any
  >
    ? IConcern
    : never;

type DependenciesOf<TImplementation> = TImplementation extends ImplementationOf<
  string,
  infer Features,
  {},
  any
>
  ? Features extends DependsOn<string>
    ? Features
    : never
  : never;

type DependenciesOfFeature<Features> = Features extends DependsOn<string>
? Features
: never;

type FeaturesOf<TImplementation> = TImplementation extends ImplementationOf<
  string,
  infer Features,
  {},
  any
>
  ? Features
  : never;

function createConcern<Type>(): <T extends string>(
  brand: TrueStringLiteral<T>
) => ConcernOf<T, Type> {
  return function implementConcern(name) {
    type ConcreteConcern = ConcernOf<typeof name, Type>;
    const concern: ConcreteConcern = ((imf: (props: any) => any) => {
      return new ImplementationOf(name, imf);
    }) as any;
    // @ts-ignore : TODO: fix it
    concern.brand = name;
    concern[Symbol.iterator] = function* () {
      let x = null;
      const context = yield { feature: '__context__' } as never;
      if (!(name in (context as object))) {
        throw new Error('notfound');
      }
      //
      return (context as any)[name] as unknown as Type;
    };
    return concern as ConcreteConcern;
  };
}

function createConcreteConcern<
  Interface,
  Yields extends AnyImplementationFeatures,
  Props extends {}
>(
  impl: (props: Props) => Generator<Yields, Interface>
): <T extends string>(
  brand: TrueStringLiteral<T>
) => [ConcernOf<T, Interface>, ImplementationOf<T, Yields, Props, Interface>] {
  return (brand) => {
    const Concern = createConcern<Interface>()(brand);
    return [Concern, Concern(impl)];
  };
}

type GenProvidedImp<
  Brand extends string,
  Features extends AnyImplementationFeatures,
  Props,
  Interface,
  T extends (AnyImplementation | ((x: any) => AnyImplementation))[]
> = ImplementationOf<
  Brand,
  | SafeStrip<Features, GetBrandForEmptyPropsImplementation<T[number]>>
  | GetFeaturesForEmptyPropsImplementation<T[number]>,
  Props & Merge<GetFeaturesFactoryProps<T[number]>>,
  Interface
>;

type GetFeaturesForEmptyPropsImplementation<I> = I extends (
  x: any
) => ImplementationOf<infer a, infer b, infer c, infer d>
  ? GetFeaturesForEmptyPropsImplementation<ImplementationOf<a, b, c, d>>
  : I extends ImplementationOf<string, infer Interface, {}, any>
  ? Interface
  : never;

type GetBrandForEmptyPropsImplementation<I> = I extends (
  x: any
) => ImplementationOf<infer a, infer b, infer c, infer d>
  ? GetBrandForEmptyPropsImplementation<ImplementationOf<a, b, c, d>>
  : I extends ImplementationOf<infer Interface, any, {}, any>
  ? Interface
  : never;

type Merge<T extends object> = {
  [k in AllKeys<T>]: PickType<T, k>;
};
type PickType<T, K extends AllKeys<T>> = T extends { [k in K]: any }
  ? T[K]
  : never;
type AllKeys<T> = T extends any ? keyof T : never;

type GetFeaturesFactoryProps<I> = I extends (x: infer X) => AnyImplementation
  ? X
  : {};

type GetAllImplInterfaces<T> = {
  [P in keyof T]: InterfaceOf<T[P]>;
};

type GetAllImplFeatures<T extends any[]> = T[number] extends ImplementationOf<
  string,
  infer D,
  any,
  any
>
  ? D
  : never;

function* Include<T extends AnyImplementation[]>(
  ...args: T
): Generator<GetAllImplFeatures<T>, GetAllImplInterfaces<T>> {
  return (yield [
    ...args.map((x) => x.__factory__({})),
  ] as never) as GetAllImplInterfaces<T>;
}

function createSyncHandler<W, B extends string>(
  feature: TrueStringLiteral<B>,
  trueHandler: (x: any) => Generator<W, any>
) {
  return function* handle<I, F extends AnyImplementationFeatures>(
    s: Generator<F, I>
  ): Generator<Extract<F, { feature: B }> | W, I> {
    let next = undefined;
    while (true) {
      const ret = s.next(next);
      if (ret.done) {
        return ret.value;
      }
      if (ret.value instanceof Array) {
        next = yield ret.value.map((x) => handle(x)) as never;
      } else {
        debugger;
        next =
          feature === ret.value.feature
            ? yield* trueHandler(ret.value)
            : yield ret.value as never;
      }
    }
  };
}

export type {
  ConcernOf,
  BrandOf,
  InterfaceOf,
  AnyConcern,
  AnyImplementation,
  PropsOf,
  ImplementedConcernOf,
  DependenciesOf,
  FeaturesOf,
  DependsOn,
  // Effectful,
};
export { createConcern, createConcreteConcern, Include, ImplementationOf };
