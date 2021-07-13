import { stream, never, EventStream } from '../stream';
import { readEvents } from './channel';
import { testBed } from '../debug';
import { delay } from './task';

describe('concurrency/channel', () => {
  it('reader is faster than producer', () => {
    return testBed((interact) => {
      const [event, emit] = stream<number>();

      const channel = readEvents({
        from: event,
        until: never(),
      });

      return interact(function* () {
        yield* delay(10);
        let i = 10;
        while (i) {
          emit(i);
          i--;
          yield* delay(10);
        }
        channel.dispose();
      }).expectEffects(function* () {
        while (yield* channel.hasNext()) {
          yield* channel.next();
        }
      });
    });
  });

  it('reader is slower than producer', () => {
    return testBed((interact) => {
      const [event, emit] = stream<number>();

      const channel = readEvents({
        from: event,
        until: never(),
      });

      return interact(function* () {
        let i = 10;
        while (i) {
          emit(i);
          i--;
          yield* delay(10);
        }
        channel.dispose();
      }).expectEffects(function* () {
        while (yield* channel.hasNext()) {
          yield* channel.next();
          yield* delay(20);
        }
      });
    });
  });

  it('reader is faster than producer (read until error)', () => {
    return testBed((interact) => {
      const [event, emit] = stream<number>();

      const channel = readEvents({
        from: event,
        until: never(),
      });

      return interact(function* () {
        yield* delay(10);
        let i = 10;
        while (i) {
          emit(i);
          i--;
          yield* delay(10);
        }
        channel.dispose();
      }).expectEffects(function* () {
        while (true) {
          try {
            yield* channel.next();
          } catch {
            break;
          }
        }
      });
    });
  });

  it('reader is slower than producer (read until error)', () => {
    return testBed((interact) => {
      const [event, emit] = stream<number>();

      const channel = readEvents({
        from: event,
        until: never(),
      });

      return interact(function* () {
        let i = 10;
        while (i) {
          emit(i);
          i--;
          yield* delay(10);
        }
        channel.dispose();
      }).expectEffects(function* () {
        while (true) {
          try {
            yield* channel.next();
          } catch {
            break;
          }
          yield* delay(20);
        }
      });
    });
  });

  it('controlled by until', () => {
    return testBed((interact) => {
      const [event, emit] = stream<number>();

      const channel = readEvents({
        from: event,
        until: new EventStream((p) => {
          const id = setInterval(() => {
            p(0);
          }, 500);
          return () => clearInterval(id);
        }),
      });

      return interact(function* () {
        let i = 10;
        while (i) {
          emit(i);
          i--;
          yield* delay(100);
        }
      }).expectEffects(function* () {
        while (true) {
          try {
            yield* channel.next();
          } catch {
            break;
          }
          yield* delay(20);
        }
      });
    });
  });
});
