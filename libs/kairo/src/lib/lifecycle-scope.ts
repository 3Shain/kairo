import { CanceledError, CancellablePromise } from './concurrency';
import { Cleanable } from './types';
import { doCleanup, noop } from './misc';

type LifecycleLogic = () => Cleanable;

function filterCanceledError(x: unknown) {
  if (!(x instanceof CanceledError)) {
    throw x;
  }
}

let currentCollecting: LifecycleLogic[] | null = null;

function collectScope() {
  const stored = currentCollecting;
  currentCollecting = [];
  const current = currentCollecting;
  return () => {
    if (currentCollecting !== current) {
      throw new Error('Nested scope');
    }
    currentCollecting = stored;
    return new LifecycleScope(current);
  };
}

class LifecycleScope {
  public constructor(private onmountLogics: LifecycleLogic[]) {}

  private attached = false;
  attach() {
    /* istanbul ignore if */
    if (this.attached) {
      return;
    }
    this.attached = true;
    const cleanups = this.onmountLogics.map((x) => {
      const cleanup = x();
      if (cleanup instanceof CancellablePromise) {
        // TODO: ignore specific error: CancelledError
        cleanup.catch(filterCanceledError);
      }
      return cleanup;
    });
    return (this.detach = () => {
      if (this.attached) {
        this.attached = false;
        cleanups.forEach(doCleanup);
      }
    });
  }

  detach: () => void = noop;
}

function lifecycle(onInit: LifecycleLogic) {
  if (currentCollecting) {
    return currentCollecting.push(onInit);
  }
  throw new TypeError('Not inside a scope');
}

export { lifecycle, LifecycleScope, collectScope };
