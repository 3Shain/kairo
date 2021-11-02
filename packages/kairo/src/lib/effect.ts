import { Cell, Reaction } from './cell';
import { lifecycle } from './lifecycle-scope';

export function effect(sideEffect: ($: typeof Cell.track) => void) {
  const doEffect = () => {
    try {
      sideEffect(Cell.track);
    } catch (e) {
      console.error(`Captured error inside effect().`, e);
    }
  };
  const reaction = new Reaction(() => {
    reaction.track(doEffect);
  });
  lifecycle(() => {
    reaction.track(doEffect);
    return () => reaction.dispose();
  });
}

// export class LayoutQueue {
//   private queue: (() => void)[] = [];

//   enqueue(job: () => void) {
//     if (this.queue.length === 0) {
//       requestAnimationFrame(() => {
//         if (!this.willFlush /* template will take care */ && this.queue.length) {
//           this.flush();
//         }
//       });
//     }
//     this.queue.push(job);
//   }

//   private willFlush: boolean = false;

//   preflush() {
//     this.willFlush = true;
//   }

//   flush() {
//     this.willFlush = false;
//     try {
//       for (const job of this.queue) {
//         job();
//       }
//     } finally {
//       this.queue.length = 0;
//     }
//   }
// }

// export const LAYOUT_QUEUE = Identifier.of<LayoutQueue>(LayoutQueue.name);

// export function layout(sideEffect: () => void) {
//   const queue = consume(LAYOUT_QUEUE);

//   const doEffect = () => {
//     try {
//       sideEffect();
//     } catch (e) {
//       console.error(`Captured error inside layout().`, e);
//     }
//   };
//   const reaction = new Reaction(() => {
//     queue.enqueue(() => reaction.execute(doEffect));
//   });
//   lifecycle(() => {
//     reaction.execute(doEffect);
//     return () => reaction.dispose();
//   });
// }
