import { Scope } from 'kairo';
import { KairoContext } from './context';
import { h } from 'preact';
import { useEffect } from 'preact/compat';

export function createKairoApp(setup?: () => void) {
  const rootScope = new Scope();
  const endScope = rootScope.beginScope();
  // platform setup (tokens)
  setup?.();
  endScope();
  const topScope = new Scope(undefined, rootScope);
  const App: React.FunctionComponent = ({ children }) => {
    useEffect(() => {
      return rootScope.attach();
    }, []);
    return (
      <KairoContext.Provider value={topScope}>{children}</KairoContext.Provider>
    );
  };

  return {
    scope: rootScope,
    App,
  };
}
