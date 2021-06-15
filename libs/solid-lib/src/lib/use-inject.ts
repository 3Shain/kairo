import {
  action,
  UnwrapProperty as ExtractBehaviorProperty,
  Factory,
  inject,
  Token,
  isCell,
  Scope,
  Cell,
} from 'kairo';
import { createEffect, onCleanup, useContext } from 'solid-js';
import { KairoContext } from './context';

export function useInject<T>(
  fn: Factory<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T extends Cell<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject<T>(
  token: Token<T>,
  options?: {
    optional?: true;
    skipSelf?: boolean;
    defaultValue: T;
  }
): T extends Cell<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T extends Cell<infer C> ? () => C : ExtractBehaviorProperty<T>;
export function useInject(token: any, options: any): any {
  if (Scope.current) {
    throw Error('Use `inject` instead of `useInject` if inside a scope.');
  }
  const context = useContext(KairoContext);
  let expose = {};
  const scope = new Scope(context);
  {
    const endScope = scope.beginScope();
    const resolve = inject(token, options);
    if (typeof resolve !== 'object' || resolve === null) {
      return resolve;
    }
    if (isCell(resolve)) {
      return () => resolve.value;
    }
    for (const [key, value] of Object.entries(resolve)) {
      if (typeof value === 'function') {
        expose[key] = action(value);
      } else if (isCell(value)) {
        Object.defineProperty(expose, key, {
          get() {
            return value.value;
          },
          enumerable: true,
          configurable: true,
        });
      } else {
        expose[key] = value;
      }
    }
    endScope();
  }
  createEffect(() => {
    const dispose = scope.attach();
    onCleanup(dispose);
  });
  return expose;
}
