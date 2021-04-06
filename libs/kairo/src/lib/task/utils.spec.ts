import { any, all, allSettled, race, delay } from './utils';
import { taskExecutor } from './task';

describe('task/utils', () => {
    function runTask() {}

    it('race should return the first settled task: when success', (done) => {
        taskExecutor(
            (function* () {
                return yield* race([
                    delay(100),
                    (function* () {
                        yield* delay(150);
                        throw Error();
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                    (function* () {
                        yield* delay(100);
                        throw Error();
                    })(),
                    (function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        return 3;
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        throw Error();
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        return 3;
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        return 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        return 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        throw 3;
                    })(),
                ]);
            })(),
            null,
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
                    (function* () {
                        yield* delay(50);
                        throw 1;
                    })(),
                    (function* () {
                        yield* delay(100);
                        throw 2;
                    })(),
                    (function* () {
                        yield* delay(20);
                        throw 3;
                    })(),
                ]);
            })(),
            null,
            (success: number) => {
               done(success);
            },
            (error) => {
                done();
            }
        );
    });
});
