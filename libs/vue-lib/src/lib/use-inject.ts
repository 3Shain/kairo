import {
  Behavior,
  Scope,
  UnwrapProperty as ExtractBehaviorProperty,
  Factory,
  inject,
  Token,
  isCell,
  effect,
} from 'kairo';
import {
  inject as vueInject,
  ref,
  reactive,
  onUnmounted,
  Ref,
  onMounted,
  onActivated,
  onDeactivated,
} from 'vue';
import { SCOPE } from './context';

export function useInject<T>(
  fn: Factory<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
  token: Token<T>,
  options?: {
    optional?: true;
    skipSelf?: boolean;
    defaultValue: T;
  }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject<T>(
  token: Token<T>,
  options?: {
    optional?: boolean;
    skipSelf?: boolean;
  }
): T extends Behavior<infer C> ? Ref<C> : ExtractBehaviorProperty<T>;
export function useInject(token: any, options: any): any {
  const scope = new Scope(vueInject(SCOPE));

  let detachHandler: Function | null = null;

  onMounted(() => {
    detachHandler = scope.attach();
  });

  onUnmounted(() => {
    detachHandler!();
    detachHandler = null;
  });

  let deactivating = false;

  onActivated(() => {
    if (deactivating) {
      detachHandler = scope.attach();
      deactivating = false;
    }
  });

  onDeactivated(() => {
    detachHandler!();
    detachHandler = null;
    deactivating = true;
  });

  const endScope = scope.beginScope();
  let expose = {};
  {
    const resolve = inject(token, options);
    if (typeof resolve !== 'object' || resolve === null) {
      endScope();
      return resolve;
    }
    if (isCell(resolve)) {
      const tRef = ref(resolve.value);
      effect(() =>
        resolve.watch((updated) => {
          tRef.value = updated;
        })
      );
      endScope();
      return tRef;
    }
    for (const [key, value] of Object.entries(resolve)) {
      if (typeof value === 'function') {
        expose[key] = value;
      } else if (isCell(value)) {
        const tRef = ref(value.value);
        effect(() =>
          value.watch((updated) => {
            tRef.value = updated;
          })
        );
        expose[key] = tRef;
      } else {
        expose[key] = value;
      }
    }
  }
  endScope();
  return reactive(expose);
}
