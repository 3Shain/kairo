import { any, all, allSettled, race, delay } from './utils';
import { task, taskExecutor } from './task';

// polyfill
if (typeof AggregateError === 'undefined') {
    (globalThis.AggregateError as any) = class extends Error {
        constructor(...args: any[]) {
            super('');
        }
    };
}

describe('task/utils', () => {
    it('race should return the first settled task: when success', (done) => {
        taskExecutor(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* delay(150);
                        throw Error();
                    })(),
                ]);
            })(),
            (success) => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('race should return the first settled task: when failed', (done) => {
        taskExecutor(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                ]);
            })(),
            (success) => {
                // done(success);
            },
            (error) => {
                done();
            }
        );
    });

    it('any should return the first fulfilled task: when any success', (done) => {
        taskExecutor(
            (function* () {
                return yield* any([
                    task(function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            (success: number) => {
                expect(success).toBe(1);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('any should fail when all failed', (done) => {
        taskExecutor(
            (function* () {
                return yield* any([
                    task(function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                    task(function* () {
                        yield* delay(100);
                        throw Error();
                    })(),
                    task(function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            (success) => {},
            (error) => {
                done();
            }
        );
    });

    it('all should return all fulfilled task', (done) => {
        taskExecutor(
            (function* () {
                return yield* all([
                    task(function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        return 3;
                    })(),
                ]);
            })(),
            (success: number) => {
                expect(success).toStrictEqual([1, 2, 3]);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('all should fail when any task fail', (done) => {
        taskExecutor(
            (function* () {
                return yield* all([
                    task(function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            (success: number) => {},
            (error) => {
                done();
            }
        );
    });

    it('allSettled should return all fulfilled task', (done) => {
        taskExecutor(
            (function* () {
                return yield* allSettled([
                    task(function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        return 3;
                    })(),
                ]);
            })(),
            (success: number) => {
                expect(success).toStrictEqual([
                    {
                        success: true,
                        value: 1,
                    },
                    {
                        success: true,
                        value: 2,
                    },
                    {
                        success: true,
                        value: 3,
                    },
                ]);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('allSettled should return all settled task', (done) => {
        taskExecutor(
            (function* () {
                return yield* allSettled([
                    task(function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        throw 3;
                    })(),
                ]);
            })(),
            (success: number) => {
                expect(success).toStrictEqual([
                    {
                        success: true,
                        value: 1,
                    },
                    {
                        success: true,
                        value: 2,
                    },
                    {
                        success: false,
                        value: 3,
                    },
                ]);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('allSettled should fail when all task fail', (done) => {
        taskExecutor(
            (function* () {
                return yield* allSettled([
                    task(function* () {
                        yield* delay(50);
                        throw 1;
                    })(),
                    task(function* () {
                        yield* delay(100);
                        throw 2;
                    })(),
                    task(function* () {
                        yield* delay(20);
                        throw 3;
                    })(),
                ]);
            })(),
            (success: number) => {
                done(success);
            },
            (error) => {
                done();
            }
        );
    });
});
