import { EventStream } from '../public-api';
import { Runnable } from './types';

const END = {};

export interface ReadableChannel<T> {
  next(): Runnable<T>;
  hasNext(): Runnable<boolean>;
  dispose(): void;
}

function eventReaderBase<T>(
  from: EventStream<T>,
  until: EventStream<any>
): ReadableChannel<T> {
  let closed = false;
  let bufferQueue: any[] = [];
  let continuation: Function | null = null;
  const stopUntilListener = until.listen((next) => {
    if (!closed) {
      dispose();
      if (continuation) {
        continuation(END);
        continuation = null;
      }
    }
  });
  const stopFromListener = from.listen((next) => {
    if (continuation) {
      continuation(next);
    } else {
      bufferQueue.push(next);
    }
  });

  function dispose() {
    if (!closed) {
      stopUntilListener();
      stopFromListener();
      closed = true;
    }
  }

  const next = function* (): Runnable<T> {
    if (continuation !== null) {
      throw new Error(`There exists a Task waiting for this channel already.`);
    }
    if (closed) {
      throw new Error(`Closed`);
    }
    if (bufferQueue.length > 0) {
      return bufferQueue.shift() as T;
    }
    return (yield (resolve, reject) => {
      continuation = (value: T) => {
        if (value === END) {
          reject(new Error(`Closed`));
          return;
        }
        continuation = null;
        resolve(value);
      };
      return () => {
        continuation = null;
      };
    }) as T;
  };

  const hasNext = function* (): Runnable<boolean> {
    if (continuation !== null) {
      throw new Error(`There exists a Task waiting for this channel already.`);
    }
    if (closed) {
      return false;
    }
    if (bufferQueue.length > 0) {
      return true;
    }
    return yield (resolve) => {
      continuation = (value: unknown) => {
        if (value === END) {
          continuation = null;
          resolve(false);
          return;
        }
        bufferQueue.push(value);
        continuation = null;
        resolve(true);
      };
      return () => {
        continuation = null;
      };
    };
  };

  return {
    next,
    hasNext,
    dispose,
  };
}

export function readEvents<TF, TU>(props: {
  from: EventStream<TF>;
  until: EventStream<TU>;
}): ReadableChannel<TF> {
  return eventReaderBase(props.from, props.until);
}
