import { Scope } from 'kairo';
import { InjectionKey } from 'vue';

export const SCOPE = Symbol('kairo scope') as InjectionKey<Scope>;
