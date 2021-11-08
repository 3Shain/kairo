import {
  Component,
  onCleanup,
  getListener,
  useContext,
  createSignal,
  runWithOwner,
  getOwner,
  onMount,
  untrack,
  PropsWithChildren,
} from 'solid-js';
import { Cell, collectScope, Reaction } from 'kairo';
import type { Track } from 'kairo';
import type { JSX } from 'solid-js';
import { KairoContext } from './context';

// function patchedTrack<T>(
//   cell: Cell<T> & {
//     signal_ref?: WeakMap<ReturnType<typeof getOwner>, Function>;
//   }
// ) {
//   if (getListener()) {
//     const { owner } = getListener();
//     if (!cell.signal_ref) {
//       cell.signal_ref = new WeakMap();
//     }
//     const refRead = cell.signal_ref.get(owner);
//     if (refRead === undefined) {
//       const update = () => {
//         reaction.track(($) => write(() => untrack(() => $(cell))));
//       };
//       const reaction = new Reaction(update);
//       const [read, write] = createSignal();
//       update();
//       cell.signal_ref.set(owner, read);
//       runWithOwner(owner, () => {
//         onCleanup(() => {
//           reaction.dispose();
//           cell.signal_ref.delete(owner);
//         });
//       });
//       return read();
//     } else {
//       return refRead();
//     }
//   }
//   return cell.current;
// }

// TODO: it might not work with transition? test it out
function passiveTrack<T>(cell: Cell<T>) {
  if (getListener()) {
    let disposed = false;
    const reaction = new Reaction(() => {
      write(() => cell.current);
      if (disposed) {
        reaction.dispose();
      }
    });
    const [read, write] = createSignal();
    onCleanup(() => {
      disposed = true;
    });
    read(); // trig track
    return reaction.track(($) => $(cell));
  }
  return cell.current;
}

function withKairo<Props>(
  setup: (
    props: Props
  ) => (track: Track, props: PropsWithChildren<Props>) => JSX.Element
): Component<Props> {
  return (
    props: Props & {
      children?: JSX.Element;
    }
  ) => {
    const context = useContext(KairoContext);

    const exitScope = collectScope();
    const exitContext = context.runInContext();
    let Component: (
      track: Track,
      props: PropsWithChildren<Props>
    ) => JSX.Element;
    try {
      Component = setup({
        ...props,
      } as any);
    } finally {
      exitContext();
      const lifecycle = exitScope();
      onMount(() => {
        const dispose = lifecycle.attach();
        onCleanup(dispose);
      });
    }

    return Component(passiveTrack, props);
  };
}

export { withKairo };
