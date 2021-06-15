import { Cell } from 'kairo';
import { Ref } from 'vue';

export type GetBehaviors<T> = {
  [P in keyof T]: Cell<T[P]>;
};

export type RemoveBehaviors<T> = {
  [P in keyof T]: T[P] extends Cell<infer C> ? Ref<C> : T[P];
};
