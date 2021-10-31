import { lifecycle } from './lifecycle-scope';
import { EventStream, stream } from './stream';
import { TeardownLogic } from './types';

interface Scheduler<T, R = T> {
  (next: (payload: R) => void): (payload: T) => void | TeardownLogic;
}

function debounce<T>(time: number): Scheduler<T> {
  let timeoutId: any = undefined; // number or NodeJS.Timeout

  return (next) => {
    return (payload) => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        next(payload);
        timeoutId = undefined;
      }, time);
    };
  };
}

function throttle<T>(time: number): Scheduler<T> {
  let timeoutId: any = undefined;
  let lastFired = 0;

  return (next) => {
    return (payload) => {
      if (Date.now() - lastFired > time) {
        next(payload);
        lastFired = Date.now();
      } else {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          next(payload);
          lastFired = Date.now();
          timeoutId = undefined;
        }, Date.now() - lastFired);
      }
    };
  };
}

const animation = <T>(next: (payload: T) => void) => {
  let rafId = 0;

  return (payload: T) => {
    // last rafId is auto disposed
    rafId = requestAnimationFrame(() => {
      next(payload);
      rafId = 0;
    });
    return () => cancelAnimationFrame(rafId);
  };
};

function scheduled<T, R = T>(
  source: EventStream<T>,
  scheduler: Scheduler<T, R>
) {
  const [dest, emitDest] = stream<R>();
  lifecycle(() => source.listen(scheduler(emitDest)));
  return dest;
}

export { scheduled, Scheduler, debounce, throttle, animation };
