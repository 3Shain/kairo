import { Cell,  Reference } from 'kairo';

export function ngSetup<Props, Model extends object>(
  setup: (
    props: Props
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