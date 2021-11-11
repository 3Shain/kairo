import { LifecycleScope } from 'kairo';
import { onMounted, onUnmounted, onActivated, onDeactivated } from 'vue';

export function useScopeController(scope: LifecycleScope) {
  let detachHandler: Function | null = null;

  onMounted(() => {
    detachHandler = scope.attach();
  });
  onUnmounted(() => {
    if (insideKeepAlive) return;
    detachHandler!();
    detachHandler = null;
  });

  let insideKeepAlive = false;
  let deactivating = false;
  onActivated(() => {
    insideKeepAlive = true;
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
}
