import { App, Plugin } from 'vue';
import { Scope } from 'kairo';
import { SCOPE } from './context';

export function createKairoApp(setup?: () => void) {
  const rootScope = new Scope();
  const endScope = rootScope.beginScope();
  // platform setup (tokens)
  setup?.();
  endScope();
  const topScope = new Scope(undefined, rootScope);

  return {
    install: (app: App) => {
      const mount = app.mount,
        unmount = app.unmount;
      let detach: () => void = null;
      // dirty patches
      app.mount = function () {
        detach = rootScope.attach();
        mount.call(app);
      }.bind(app);
      app.unmount = function () {
        detach?.();
        unmount.call(app);
      };
      app.provide(SCOPE, topScope);
    },
  } as Plugin;
}
