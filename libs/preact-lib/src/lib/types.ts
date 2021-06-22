import { Behavior } from 'kairo';

export type ToObject<T> = {
  [P in keyof T]: T[P] extends Behavior<infer C> ? C : T[P];
};

export type ToBehaviors<T> = T extends any
  ? any
  : {
      [P in keyof T]: Behavior<T[P]>;
    };
