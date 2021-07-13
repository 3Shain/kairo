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
      app.mount = function (...args: any[]) {
        detach = rootScope.attach();
        return mount.apply(app, args);
      }.bind(app);
      app.unmount = function () {
        detach?.();
        return unmount.apply(app);
      };
      app.provide(SCOPE, topScope);
    },
  } as Plugin;
}
