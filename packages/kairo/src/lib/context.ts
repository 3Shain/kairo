type Identifier<T = unknown> = symbol & { _0: T };

const Identifier = {
  of: <T>(
    description: string,
    options?: {
      suggesstion?: string;
    }
  ) => {
    const id = Symbol(description) as Identifier<T>;
    if (options) {
      if (options.suggesstion) {
      }
    }
    return id;
  },
};

let currentContext: Context | null = null;

class Context {
  constructor(private entries: Map<Identifier, any> = new Map()) {}

  static EMPTY = new Context();

  get<T>(token: Identifier<T>, options?: any): T {
    if (this.entries.has(token)) {
      return this.entries.get(token);
    }
    if (options?.optional) {
      return options.defaultValue ?? undefined;
    }
    throw new IdentifierNotFoundError(token);
  }

  runInContext() {
    const stored = currentContext;
    currentContext = this;
    return () => {
      if (currentContext !== this) {
        throw new Error('Exit inner context before outer context.');
      }
      currentContext = stored;
    };
  }

  inherit(module: ConcernExport) {
    return new Context(
      new Map([
        ...this.entries,
        ...Object.getOwnPropertySymbols(module).map(
          (ssymbol) => [ssymbol, (module as any)[ssymbol]] as [Identifier, any]
        ),
      ])
    );
  }

  /**
   * Build a new context based on current from concern.
   * @param concern 
   * @returns 
   */
  build(concern: Concern) {
    const exitContext = this.runInContext();
    try {
      const exports = concern() ?? {};
      return this.inherit(exports as any);
    } finally {
      exitContext();
    }
  }
}

class IdentifierNotFoundError extends Error {
  constructor(public readonly identifier: Identifier) {
    super(`'${identifier.description}' is not found in current context.`);
  }
}

// type IdValuePair<T = any> = [Identifier<T>, T];

// TODO: enhancement: typescript 4.4 - symbol index signatures
type ConcernExport = NonNullable<object>;

function injected<T>(
  id: Identifier<T>,
  options?: {
    optional?: true;
    defaultValue: T;
  }
): T;
function injected<T>(
  id: Identifier<T>,
  options?: {
    optional?: true;
  }
): T | undefined;
function injected<T>(
  id: Identifier<T>,
  options?: {
    optional?: boolean;
  }
): T;
function injected(token: any, options?: any): any {
  if (currentContext) {
    return currentContext.get(token, options);
  }
  throw new TypeError('Not inside a context.');
}

type Concern = () => ConcernExport | void;

type Concerns = Array<Concerns | Concern>;

function reduceConcerns(concerns: Concerns): Concern {
  return () => {
    const exports = {};
    let context = currentContext!; // TODO: maybe not?
    for (const concernOrArray of concerns) {
      const concern =
        concernOrArray instanceof Array
          ? reduceConcerns(concernOrArray)
          : concernOrArray;
      const exitContext = context.runInContext();
      try {
        const concernExport = concern() ?? {};
        Object.assign(exports, concernExport);
        context = context.inherit(concernExport as any);
      } finally {
        exitContext();
      }
    }
    return exports;
  };
}

export {
  injected,
  reduceConcerns,
  Identifier,
  Context,
  Concern,
  Concerns,
  ConcernExport,
  IdentifierNotFoundError
};
