import { CancellablePromise, CanceledError } from './promise';

describe('concurrency/promise', () => {
  it('is a promise', async () => {
    const promise = new CancellablePromise((resolve) => {
      setTimeout(() => {
        resolve(16);
      }, 10);
    });
    await expect(promise).resolves.toBe(16);
    const thrown = {};
    const promise2 = new CancellablePromise((_, reject) => {
      setTimeout(() => {
        reject(thrown);
      }, 10);
    });
    await expect(promise2).rejects.toBe(thrown);
  });

  it('cancel works', async () => {
    const promise = new CancellablePromise<number>((resolve) => {
      const id = setTimeout(() => {
        resolve(16);
      }, 10);
      return () => clearTimeout(id);
    });
    const g = Promise.all([
      expect(promise).rejects.toBeInstanceOf(CanceledError),
      expect(promise.then((x) => x * 2)).rejects.toBeInstanceOf(CanceledError),
    ]);
    promise.cancel();
    promise.cancel();// idempotent
    await g;
  });
});
