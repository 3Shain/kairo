import { AbortedError } from '.';
import { all, allSettled, any, race } from './combinators';
import { neverFulfill } from './spec-shared';
import { timeout, delay, executeRunnableTask, TaskSuspended, task } from './task';

// polyfill
if (typeof AggregateError === 'undefined') {
  (globalThis.AggregateError as any) = class extends Error {
    constructor(...args: any[]) {
      super('');
    }
  };
}

describe('concurrency/combinators', () => {
  describe('race()', () => {
    it('should yield immediately if a task is synchronous', () => {
      function* task() {
        return 0;
      }

      const ret = executeRunnableTask(race([delay(0), task()]));

      expect(ret).toStrictEqual({
        type: 'fulfill',
        value: 0,
      });
    });

    it('should yield the first settled task', (done) => {
      function* task() {
        yield* delay(0);
        return 10;
      }

      try {
        executeRunnableTask(race([delay(4), task()]), (ret) => {
          expect(ret).toStrictEqual({
            type: 'fulfill',
            value: 10,
          });
          done();
        });
      } catch {}
    });

    it('can be aborted', async ()=> {
      const fn = jest.fn();

      const p = task(function*(){
        yield* race([neverFulfill(fn),neverFulfill(fn)]);
        throw 'never';
      })();

      setTimeout(()=>{
        p.abort();
        expect(fn).toBeCalledTimes(2);
      });

      await expect(p).rejects.toBeInstanceOf(AbortedError);
    });
  });

  describe('any()', () => {
    it('should yield immediately if a task is synchronously fulfilled', () => {
      function* task() {
        return 0;
      }
      const ret = executeRunnableTask(any([delay(0), task()]));

      expect(ret).toStrictEqual({
        type: 'fulfill',
        value: 0,
      });
    });

    it('should yield the first fulfilled task', (done) => {
      function* task() {
        yield* delay(0);
        return 10;
      }

      try {
        executeRunnableTask(any([delay(4), task()]), (ret) => {
          expect(ret).toStrictEqual({
            type: 'fulfill',
            value: 10,
          });
          done();
        });
      } catch {}
    });

    it('should yield immediately when all sync task failed', () => {
      function* task() {
        throw new Error();
      }
      const ret = executeRunnableTask(any([task(), task(), task()]));

      expect(ret.type).toBe('error');
    });

    it('should yield when all async task failed', (done) => {
      try {
        executeRunnableTask(
          any([timeout(0), timeout(1), timeout(2)]),
          (ret) => {
            expect(ret.type).toBe('error');
            // expect(ret.error).
            done();
          }
        );
      } catch {}
    });

    it('can be aborted', async ()=> {
      const fn = jest.fn();

      const p = task(function*(){
        yield* any([neverFulfill(fn),neverFulfill(fn)]);
        throw 'never';
      })();

      
      setTimeout(()=>{
        p.abort();
        expect(fn).toBeCalledTimes(2);
      });

      await expect(p).rejects.toBeInstanceOf(AbortedError);
    });
  });

  describe('all()', () => {
    it('should yield immediately if all tasks synchronously fulfilled', () => {
      function* task() {
        return 0;
      }
      const ret = executeRunnableTask(all([task(), task(), task()]));

      expect(ret).toStrictEqual({
        type: 'fulfill',
        value: [0, 0, 0],
      });
    });

    it('should yield when all tasks fulfilled', (done) => {
      function* task() {
        yield* delay(0);
        return 10;
      }

      try {
        executeRunnableTask(all([task(), task(), task()]), (ret) => {
          expect(ret).toStrictEqual({
            type: 'fulfill',
            value: [10, 10, 10],
          });
          done();
        });
      } catch {}
    });

    it('should yield immediately when any sync task failed', () => {
      function* task() {
        throw new Error('custom error');
      }
      const ret = executeRunnableTask(all([delay(), task()]));

      expect(ret.type).toBe('error');
      // @ts-ignore
      expect(ret.error.message).toBe('custom error');
    });

    it('should yield when any async task failed', (done) => {
      try {
        executeRunnableTask(all([delay(0), timeout(1), timeout(2)]), (ret) => {
          expect(ret.type).toBe('error');
          // expect(ret.error).
          done();
        });
      } catch {}
    });

    it('can be aborted', async ()=> {
      const fn = jest.fn();

      const p = task(function*(){
        yield* all([neverFulfill(fn),neverFulfill(fn)]);
        throw 'never';
      })();

      setTimeout(()=>{
        p.abort();
        expect(fn).toBeCalledTimes(2);
      });

      await expect(p).rejects.toBeInstanceOf(AbortedError);
    });
  });

  describe('allSettled()', () => {
    it('should yield immediately if all tasks synchronously fulfilled', () => {
      function* task() {
        return 0;
      }
      function* task2() {
        throw 0;
      }
      const ret = executeRunnableTask(allSettled([task(), task2(), task()]));

      expect(ret).toStrictEqual({
        type: 'fulfill',
        value: [
          {
            status: 'fulfilled',
            value: 0,
          },
          {
            status: 'rejected',
            reason: 0,
          },
          {
            status: 'fulfilled',
            value: 0,
          },
        ],
      });
    });

    it('should yield when all tasks setlled', (done) => {
      try {
        executeRunnableTask(
          allSettled([delay(0), timeout(1), timeout(2)]),
          (ret) => {
            expect(ret.type).toBe('fulfill');
            // expect(ret.error).
            // @ts-ignore
            expect(ret.value.length).toBe(3);
            done();
          }
        );
      } catch {}
    });

    it('can be aborted', async ()=> {
      const fn = jest.fn();

      const p = task(function*(){
        yield* allSettled([neverFulfill(fn),neverFulfill(fn)]);
        throw 'never';
      })();

      setTimeout(()=>{
        p.abort();
        expect(fn).toBeCalledTimes(2);
      });

      await expect(p).rejects.toBeInstanceOf(AbortedError);
    });
  });
});
