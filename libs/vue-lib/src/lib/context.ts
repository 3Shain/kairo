import { Context } from 'kairo';
import { InjectionKey } from 'vue';

export const CONTEXT = Symbol('kairo context') as InjectionKey<Context>;
