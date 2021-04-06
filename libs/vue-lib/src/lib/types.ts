import { Behavior } from "kairo";
import { Ref } from 'vue';

export type GetBehaviors<T> = {
    [P in keyof T]: Behavior<T[P]>;
};

export type RemoveBehaviors<T> = {
    [P in keyof T]: T[P] extends Behavior<infer C> ? Ref<C> : T[P];
};