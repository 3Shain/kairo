import { Concern, collectScope, CONCERN_HOC_FACTORY } from 'kairo';
import {
  Component,
  createComponent,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';
import { KairoContext } from './context';

export function withConcern(concern: Concern) {
  return <Props>(component: Component<Props>): Component<Props> => {
    return (props: Props) => {
      const currentContext = useContext(KairoContext);
      const exitScope = collectScope();
      try {
        const context = currentContext.inherit({
          [CONCERN_HOC_FACTORY]: withConcern
        }).build(concern);
        return createComponent(KairoContext.Provider, {
          value: context,
          get children() {
            return createComponent(component, props);
          },
        });
      } finally {
        const scope = exitScope();
        onMount(() => {
          onCleanup(scope.attach());
        });
      }
    };
  };
}
