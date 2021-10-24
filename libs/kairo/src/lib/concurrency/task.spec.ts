import {
  timeout,
  delay,
  executeRunnableTask,
  TaskSuspended,
  task,
  resolve,
  __return,
  executeRunnableBlock,
  __continue,
  __break,
  AbortedError,
  AbortablePromise,
  TaskKilledError
} from './task';
import { race } from './combinators';
import { asapScheduler, of, scheduled, throwError } from 'rxjs';
import { neverFulfill } from './spec-shared';

// polyfill
if (typeof AggregateError === 'undefined') {
  (globalThis.AggregateError as any) = class extends Error {
    constructor(...args: any[]) {
      super('');
    }
  };
}

describe('concurrency/task', () => {
  it('sync return', () => {
    const value = Math.random();

    function* task() {
      const ret = yield () => {
        return { type: 'fulfill', value: value * 2 } as const;
      };
      expect(ret).toBe(value * 2);
      return value;
    }
    const ret = executeRunnableTask(task());
    // @ts-ignore
    expect(ret.value).toBe(value);
  });

  it('sync throw', () => {
    const error = new Error('custom error');

    function* task() {
      yield () => {
        return { type: 'fulfill', value: 0 } as const;
      };
      throw error;
    }

    const ret = executeRunnableTask(task());
    expect(ret.type).toBe('error');
    // @ts-ignore
    expect(ret.error).toBe(error);
  });

  it('sync throw uncaptured', () => {
    const error = new Error('custom error');

    function* task() {
      yield () => {
        return { type: 'error', error } as const;
      };
    }

    const ret = executeRunnableTask(task());
    expect(ret.type).toBe('error');
    // @ts-ignore
    expect(ret.error).toBe(error);
  });

  it('sync throw captured', () => {
    const error = new Error('custom error');

    function* task() {
      try {
        yield () => {
          return { type: 'error', error } as const;
        };
      } catch (e) {
        return e;
      }
    }

    const ret = executeRunnableTask(task());
    expect(ret.type).toBe('fulfill');
    // @ts-ignore
    expect(ret.value).toBe(error);
  });

  it('invalid operation', () => {
    const error = new Error('custom error');

    function* task() {
      yield (next) => {
        expect(() => next({ type: 'fulfill', value: 0 })).toThrow();
        throw error;
      };
    }

    const ret = executeRunnableTask(task());
    expect(ret.type).toBe('error');
    // @ts-ignore
    expect(ret.error).toBe(error);
  });

  it('sync throw in yield', () => {
    const error = new Error('custom error');

    function* task() {
      yield () => {
        throw error;
      };
    }

    const ret = executeRunnableTask(task());
    expect(ret.type).toBe('error');
    // @ts-ignore
    expect(ret.error).toBe(error);
  });

  it('sync return imm', () => {
    const value = Math.random();

    function* task() {
      yield () => {
        return __return(value * 2);
      };
      // will never execute
      return value;
    }
    const ret = executeRunnableBlock(task());
    expect(ret.type).toBe('complete');
    // @ts-ignore
    expect(ret.value).toBe(value * 2);
  });

  it('async return', (done) => {
    const value = Math.random();

    function* task() {
      yield* delay(1);
      yield* delay(1);
      return value;
    }
    expect(() =>
      executeRunnableTask(task(), (ret) => {
        expect(ret.type).toBe('fulfill');
        // @ts-ignore
        expect(ret.value).toBe(value);
        done();
      })
    ).toThrow();
  });

  it('async throw', (done) => {
    const value = Math.random();

    function* task() {
      yield* delay();
      yield* timeout();
      return value;
    }
    expect(() =>
      executeRunnableTask(task(), (ret) => {
        expect(ret.type).toBe('error');
        // @ts-ignore
        expect(ret.error.message).toBe('Timeout');
        done();
      })
    ).toThrow();
  });

  it('async complete', (done) => {
    const value = Math.random();

    function* task() {
      yield* delay();
      yield () => {
        return __return(value * 2);
      };
      // never
      return value;
    }
    expect(() =>
      executeRunnableBlock(task(), (ret) => {
        expect(ret.type).toBe('complete');
        // @ts-ignore
        expect(ret.value).toBe(value * 2);
        done();
      })
    ).toThrow();
  });

  it('async throw in yield', (done) => {
    const error = new Error('custom error');

    function* task() {
      yield* delay();
      yield () => {
        throw error;
      };
    }

    expect(() =>
      executeRunnableTask(task(), (ret) => {
        expect(ret.type).toBe('error');
        // @ts-ignore
        expect(ret.error).toBe(error);
        done();
      })
    ).toThrow();
  });

  it('async abort', (done) => {
    const value = Math.random();

    function* task() {
      yield* delay(1);
      return value;
    }
    try {
      executeRunnableTask(task(), (ret) => {
        expect(ret.type).toBe('error');
        // @ts-ignore
        expect(ret.error).toBeInstanceOf(AbortedError);
        done();
      });
    } catch (e) {
      const ts = e as TaskSuspended;
      ts.abort();
    }
  });

  it('force abort', (done) => {
    function* task() {
      while(true){
        try {
          yield* delay();
        } catch {
          // ignore error
        }
      }
    }
    try {
      executeRunnableTask(task(), (ret) => {
        expect(ret.type).toBe('error');
        // @ts-ignore
        expect(ret.error).toBeInstanceOf(TaskKilledError);
        done();
      });
    } catch (e) {
      const ts = e as TaskSuspended;
      ts.abort();
    }
  });

  describe('AbortablePromise',()=>{
    it('is a promise', async () => {
      const promise = new AbortablePromise((resolve) => {
        setTimeout(() => {
          resolve(16);
        }, 10);
      });
      await expect(promise).resolves.toBe(16);
      const thrown = {};
      const promise2 = new AbortablePromise((_, reject) => {
        setTimeout(() => {
          reject(thrown);
        }, 10);
      });
      await expect(promise2).rejects.toBe(thrown);
    });
  
    it('can be aborted', async () => {
      const promise = new AbortablePromise<number>((resolve) => {
        const id = setTimeout(() => {
          resolve(16);
        }, 10);
        return () => clearTimeout(id);
      });
      const g = Promise.all([
        expect(promise).rejects.toBeInstanceOf(AbortedError),
        expect(promise.then((x) => x * 2)).rejects.toBeInstanceOf(AbortedError),
      ]);
      promise.abort();
      promise.abort();// idempotent
      await g;
    });
  
    it('is a runnable', async ()=> {
      return await task(function*() { 
        const p = Math.random();
        expect(yield* new AbortablePromise((res)=>{
          res(p)
        })).toBe(p);
        try {
          yield* new AbortablePromise((_,rej)=>{
            rej(p);
          });
        } catch(e){
          expect(e).toBe(p);
        }
        const fn = jest.fn();
        yield* race([new AbortablePromise(()=>fn), 0 ])
        expect(fn).toBeCalledTimes(1);
      })();
    })
  })

  describe('task()', ()=>{
    it('should fulfill when complete.return', async ()=>{
      await expect(task(function*(){
        yield ()=>__return(0);
        throw 'never';
      })()).resolves.toBe(0);
    });

    it('should reject when complete.break', async ()=>{
      await expect(task(function*(){
        yield ()=>__break();
      })()).rejects.toBeInstanceOf(TypeError);
    });

    it('should reject when complete.continue', async ()=>{
      await expect(task(function*(){
        yield ()=>__continue();
      })()).rejects.toBeInstanceOf(TypeError);
    });
  });

  describe('resolve()', () => {
    it('resolves a Runnable', async () => {
      return await task(function* () {
        expect(
          yield* resolve(
            (function* () {
              return 0;
            })()
          )
        ).toBe(0);
      })();
    });

    it('resolves a fulfilled Promise', async () => {
      return await task(function* () {
        expect(yield* resolve(Promise.resolve(0))).toBe(0);
      })();
    });

    it('resolves a rejected Promise', async () => {
      return await task(function* () {
        try {
          yield* resolve(Promise.reject(0));
        } catch (e) {
          expect(e).toBe(0);
        }
      })();
    });

    it('resolves an Observable', async () => {
      return await task(function* () {
        expect(yield* resolve(of(0))).toBe(0);
      })();
    });

    it('resolves an Observable with error', async () => {
      return await task(function* () {
        const p = Math.random();
        try {
          yield* resolve(throwError(p));
        } catch (e) {
          expect(e).toBe(p);
        }
      })();
    });

    it('resolves an async Observable', async () => {
      return await task(function* () {
        expect(yield* resolve(scheduled([0], asapScheduler))).toBe(0);
      })();
    });

    it('resolves an async Observable with error', async () => {
      return await task(function* () {
        const p = Math.random();
        try {
          yield* resolve(throwError(p, asapScheduler));
        } catch (e) {
          expect(e).toBe(p);
        }
      })();
    });

    it('resolves ordinary object', async () => {
      const obj = {};
      return await task(function* () {
        expect(yield* resolve(obj)).toBe(obj);
      })();
    });

    it('resolves any value', async () => {
      return await task(function* () {
        expect(yield* resolve(0)).toBe(0);
      })();
    });
  });
});
