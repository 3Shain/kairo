import { InjectFlags, Type,AbstractType,InjectionToken } from '@angular/core';
import { Behavior, inject } from 'kairo';
import { NG_INJECTOR } from './tokens';

export function ngSetup<Props, Model extends object>(
    setup: (
        props: Props,
        useProps: <T>(thunk: (props: Props) => T) => Behavior<T>
    ) => Model | void
) {
    return (class {
        ngSetup = setup;
    } as unknown) as {
        new (): ToModel<Model>;
    };
}

type ToModel<T> = {
    [P in keyof T]: T[P] extends Behavior<infer C> ? C : T[P];
};

type ProviderToken<T> = Type<T> | AbstractType<T> | InjectionToken<T>;

export function ngInject<T>(
    token: ProviderToken<T>,
    notFoundValue?: T,
    flags?: InjectFlags
): T {
    return inject(NG_INJECTOR).get(token, notFoundValue, flags);
}
