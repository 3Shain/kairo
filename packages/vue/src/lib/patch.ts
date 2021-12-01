import { Cell, Reaction, Track } from 'kairo';
import { Ref, ReactiveEffect, triggerRef, ref } from 'vue';

interface PatchedReactiveEffect {
  _reaction?: Reaction;
  _fn?: Function;
  _signal?: Ref<any>;
}

export function setupVueIntegration() {
  let ctx_track: Track | null = null;

  Object.defineProperty(Cell.prototype, '__v_isRef', {
    value: true,
  });
  Object.defineProperty(Cell.prototype, 'value', {
    get: function (this: Cell<any>) {
      return ctx_track ? ctx_track(this) : this.current;
    },
  });
  Object.defineProperty(ReactiveEffect.prototype, 'fn', {
    get(this: ReactiveEffect & PatchedReactiveEffect) {
      return this._fn;
    },
    set(this: ReactiveEffect & PatchedReactiveEffect, originalFn) {
      if (this._fn) {
        this._reaction.dispose();
      } else {
        this._signal = ref(undefined);
      }
      this._reaction = new Reaction(() => triggerRef(this._signal));
      this._fn = () =>
        this._reaction.track(($) => {
          const tmp = ctx_track;
          ctx_track = $;
          try {
            return originalFn(this._signal.value);
          } finally {
            ctx_track = tmp;
          }
        });
    },
  });
  
  const origianlStop = ReactiveEffect.prototype.stop;

  Object.defineProperty(ReactiveEffect.prototype, 'stop', {
    value: function (this: ReactiveEffect & PatchedReactiveEffect) {
      origianlStop.call(this);
      this._reaction.dispose();
    },
  });
}
