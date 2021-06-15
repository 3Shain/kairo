import { TeardownLogic } from './types';
import { nextTick } from './utils/next-tick';

interface Scheduler<T> {
  (next: (payload: T) => void): (payload: T) => void | TeardownLogic;
}

const asap: Scheduler<any> = (next) => {
  return (payload) => {
    nextTick(() => {
      next(payload);
    });
  };
};

const asapInTransaction: Scheduler<any> = (next) => {
  return (payload) => {
    nextTick(() => {
      next(payload);
    });
  };
};

const async: Scheduler<any> = (next) => {
  return (payload) => {};
};

const asyncInTransaction: Scheduler<any> = (next) => {
  return (payload) => {};
};

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
  let lastFired: number = 0;

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

const animation: Scheduler<any> = (next) => {
  let rafId = 0;

  return (payload) => {
    if (rafId !== 0) {
      cancelAnimationFrame(rafId);
    }
    rafId = requestAnimationFrame(() => {
      next(payload);
      rafId = 0;
    });
  };
};

export {
  Scheduler,
  async,
  asap,
  asyncInTransaction,
  asapInTransaction,
  debounce,
  throttle,
  animation,
};
