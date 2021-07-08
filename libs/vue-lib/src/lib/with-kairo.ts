import { Cell } from 'kairo';
import {
  ComponentPublicInstance,
  defineComponent,
  SetupContext,
  VNodeChild,
} from 'vue';
import { setupKairo } from './setup-kairo';

export function withKairo<Props = {}>(
  setup: (
    props: Readonly<Props>,
    useProp: <T>(thunk: (props: Props) => T) => Cell<T>,
    ctx: SetupContext
  ) => (
    this: ComponentPublicInstance,
    mockProps: { children?: VNodeChild } & Props
  ) => VNodeChild | object
) {
  return defineComponent<Props>({
    setup: setupKairo(setup),
  });
}
