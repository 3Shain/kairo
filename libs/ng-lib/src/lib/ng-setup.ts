import { Behavior } from 'kairo';

export function ngSetup<Props, Model extends object>(
    setup: (
        props: Props,
        useProps: <T>(thunk: (props: Props) => T) => Behavior<T>
    ) => Model
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
