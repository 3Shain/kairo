import {
  Provider,
  ɵComponentType as ComponentType,
  ɵDirectiveType as DirectiveType,
  ɵDirectiveDef as DirectiveDef,
  ɵɵProvidersFeature as ProvidersFeature,
  Type,
} from '@angular/core';

export function prependProviders<T>(
  def: DirectiveDef<T>,
  providers: Provider[]
) {
  if (typeof def.providersResolver !== 'function') {
    return ProvidersFeature(providers, [])(def);
  }
  const monkeyPatch = def.providersResolver;
  def.providersResolver = (def, proc) => {
    monkeyPatch(def, (_providers) => {
      const extendedProviders = [...providers, ..._providers];
      return proc ? proc(extendedProviders) : extendedProviders;
    });
  };
}

export function hookFactory<T>(
  component: {
    ɵfac: (t: any) => any;
  } & Type<T>,
  hook: (instance: T) => T
) {
  const monkeyPatch = component.ɵfac;
  Object.defineProperty(component, 'ɵfac', {
    value: (t: any) => hook(monkeyPatch(t)),
  });
}

export function overrideLifecylePrepend<T>(
  component: Type<T>,
  prototype: {
    [index: string]: (this: T, ...args: any[]) => any;
  }
) {
  for (const [key, method] of Object.entries(prototype)) {
    const monkeyPatch = component.prototype[key] ?? (() => {});
    component.prototype[key] = function (...args: any[]) {
      method.apply(this, args);
      monkeyPatch.apply(this, args);
    };
  }
}

export function overrideLifecyleAppend<T>(
  component: Type<T>,
  prototype: {
    [index: string]: (this: T, ...args: any[]) => any;
  }
) {
  for (const [key, method] of Object.entries(prototype)) {
    const monkeyPatch = component.prototype[key] ?? (() => {});
    component.prototype[key] = function (...args: any[]) {
      monkeyPatch.apply(this, args);
      method.apply(this, args);
    };
  }
}
