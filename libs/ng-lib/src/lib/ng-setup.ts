import { InjectFlags, Type, AbstractType, InjectionToken } from '@angular/core';
import { Cell, inject, reference, Reference } from 'kairo';
import { NG_INJECTOR } from './tokens';

export function ngSetup<Props, Model extends object>(
  setup: (
    props: Props,
    useProps: <T>(thunk: (props: Props) => T) => Cell<T>
  ) => Model | void
) {
  return (class {
    ngSetup = setup;
  } as unknown) as {
    new (): Pick<ToModel<Model>, ExcludeReference<Model>>;
  };
}

type ExcludeReference<T> = {
  [P in keyof T]: T[P] extends Reference<any> ? never : P;
}[keyof T];

type ToModel<T> = {
  [P in keyof T]: T[P] extends Cell<infer C> ? C : T[P];
};

type ProviderToken<T> = Type<T> | AbstractType<T> | InjectionToken<T>;

export function ngInject<T>(
  token: ProviderToken<T>,
  notFoundValue?: T,
  flags?: InjectFlags
): T {
  return inject(NG_INJECTOR).get(token, notFoundValue, flags);
}

export function ngElementRef<T>(initial?: T) {
  return reference(initial, (x) => x.nativeElement);
}
