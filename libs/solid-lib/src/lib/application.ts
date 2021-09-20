import { Concern, Concerns, reduceConcerns, collectScope } from 'kairo';
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
    const context = currentContext.build(concern);
    const lifecycle = exitScope();
    onMount(() => {
      const detach = lifecycle.attach();
      onCleanup(detach);
    });

    return createComponent(KairoContext.Provider, {
      value: context,
      get children() {
        return createComponent(component, props);
      },
    });
  };
}

export function withConcerns<Props>(
  concerns: Concerns,
  component: Component<Props>
) {
  return withConcern(reduceConcerns(concerns), component);
}
