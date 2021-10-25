import { Concern, collectScope } from 'kairo';
import {
  Component,
  createComponent,
  onCleanup,
  onMount,
  useContext,
} from 'solid-js';
import { KairoContext } from './context';

export function withConcern<Props>(
  concern: Concern,
  component: Component<Props>
): Component<Props> {
  return (props: Props) => {
    const currentContext = useContext(KairoContext);
    const exitScope = collectScope();
    try {
      const context = currentContext.build(concern);
      return createComponent(KairoContext.Provider, {
        value: context,
        get children() {
          return createComponent(component, props);
        },
      });
    } finally {
      const lifecycle = exitScope();
      onMount(() => {
        const detach = lifecycle.attach();
        onCleanup(detach);
      });
    }
  };
}