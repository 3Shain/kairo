import {
    task,
    executeRunnable,
    delay,
    any,
    all,
    allSettled,
    race,
    timeout,
    resolve,
    Semaphore,
} from './task';
import { Observable } from 'rxjs';
import { CanceledError } from './promise';

// polyfill
if (typeof AggregateError === 'undefined') {
    (globalThis.AggregateError as any) = class extends Error {
        constructor(...args: any[]) {
            super('');
        }
    };
}

describe('task/task', () => {
    it('task can recover from error', (done) => {
        executeRunnable(
            (function* () {
                let count = 0;
                while (true) {
                    try {
                        yield* timeout(50);
                    } catch (e) {
                        count++;
                        if (count > 5) return 0;
                    }
                }
            })(),
            () => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('new error is still captured', (done) => {
        executeRunnable(
            (function* () {
                while (true) {
                    try {
                        yield* timeout(50);
                    } catch (e) {
                        throw new Error('New error');
                    }
                }
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('PromiseLike is resolvable', (done) => {
        executeRunnable(
            (function* () {
                yield* resolve(
                    new Promise((resolve) => {
                        setTimeout(resolve, 0);
                    })
                );
            })(),
            () => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('Subscrible is resolvable', (done) => {
        executeRunnable(
            (function* () {
                yield* resolve(
                    new Observable<number>((observer) => {
                        setTimeout(() => {
                            observer.next(0);
                            observer.complete();
                        }, 0);
                    })
                );
            })(),
            () => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('Subscrible is resolvable (error)', (done) => {
        executeRunnable(
            (function* () {
                yield* resolve(
                    new Observable<number>((observer) => {
                        setTimeout(() => {
                            observer.error(new Error('USER_ERROR'));
                        }, 0);
                    })
                );
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                expect(error.message).toBe('USER_ERROR');
                done();
            }
        );
    });

    it('Subscrible is resolvable (cancel)', (done) => {
        const cancel = executeRunnable(
            (function* () {
                yield* resolve(
                    new Observable<number>((observer) => {
                        const id = setTimeout(() => {
                            observer.error(new Error('USER_ERROR'));
                        }, 1000);
                        return () => clearTimeout(id);
                    })
                );
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        setTimeout(cancel, 0);
    });

    it('Unresolvable object causes an error', (done) => {
        executeRunnable(
            (function* () {
                yield* resolve({});
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('Unyieldable object causes an error', (done) => {
        executeRunnable(
            (function* () {
                yield {} as any;
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('race should return the first settled task: when success', (done) => {
        executeRunnable(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* delay(150);
                        throw Error();
                    })(),
                ]);
            })(),
            () => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('race should return the first settled task: when success (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* timeout(150);
                    })(),
                    0, //const
                ]);
            })(),
            () => {
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('race should return the first settled task: when failed', (done) => {
        executeRunnable(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                ]);
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('race should return the first settled task: when failed (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* race([
                    delay(100),
                    task(function* () {
                        yield* delay(50);
                        throw Error();
                    })(),
                    (function* () {
                        throw Error();
                    })(),
                ]);
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('any should return the first fulfilled task: when any success', (done) => {
        executeRunnable(
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
            (success) => {
                expect(success).toBe(1);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('any should return the first fulfilled task: when any success (sync)', (done) => {
        executeRunnable(
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
                    0,
                ]);
            })(),
            (success) => {
                expect(success).toBe(0);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('any should fail when all failed', (done) => {
        executeRunnable(
            (function* () {
                return yield* any([timeout(10), timeout(20), timeout(30)]);
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('any should fail when all failed (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* any([
                    (function* () {
                        throw Error();
                    })(),
                    (function* () {
                        throw Error();
                    })(),
                    (function* () {
                        throw Error();
                    })(),
                    (function* () {
                        throw Error();
                    })(),
                ]);
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('all should return all fulfilled task', (done) => {
        executeRunnable(
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
            (success: number[]) => {
                expect(success).toStrictEqual([1, 2, 3]);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('all should return all fulfilled task (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* all([1, 2, 3]);
            })(),
            (success: number[]) => {
                expect(success).toStrictEqual([1, 2, 3]);
                done();
            },
            (error) => {
                done(error);
            }
        );
    });

    it('all should fail when any task fail', (done) => {
        executeRunnable(
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
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('all should fail when any task fail (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* all([
                    (function* () {
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
                    (function* () {
                        throw Error();
                    })(),
                ]);
            })(),
            () => {
                done(Error('Not expected callback.'));
            },
            (error) => {
                done();
            }
        );
    });

    it('allSettled should return all fulfilled task', (done) => {
        executeRunnable(
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
            (success: any[]) => {
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
        executeRunnable(
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
            (success: any[]) => {
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

    it('allSettled should never fail even if all runnable fail', (done) => {
        executeRunnable(
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
            (result) => {
                expect(result).toStrictEqual([
                    {
                        success: false,
                        value: 1,
                    },
                    {
                        success: false,
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

    it('allSettled should never fail even if all runnable fail (sync)', (done) => {
        executeRunnable(
            (function* () {
                return yield* allSettled([
                    (function* () {
                        throw 1;
                    })(),
                    (function* () {
                        throw 2;
                    })(),
                    (function* () {
                        throw 3;
                    })(),
                ]);
            })(),
            (result) => {
                expect(result).toStrictEqual([
                    {
                        success: false,
                        value: 1,
                    },
                    {
                        success: false,
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

    it('any is cancelable (sync)', (done) => {
        const cancel = executeRunnable(
            any([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        cancel();
    });

    it('race is cancelable (sync)', (done) => {
        const cancel = executeRunnable(
            race([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        cancel();
    });

    it('all is cancelable (sync)', (done) => {
        const cancel = executeRunnable(
            all([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        cancel();
    });

    it('allSettled is cancelable (sync)', (done) => {
        const cancel = executeRunnable(
            allSettled([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        cancel();
    });


    it('any is cancelable', (done) => {
        const cancel = executeRunnable(
            any([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        setTimeout(cancel,0);
    });

    it('race is cancelable', (done) => {
        const cancel = executeRunnable(
            race([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        setTimeout(cancel,0);
    });

    it('all is cancelable', (done) => {
        const cancel = executeRunnable(
            all([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        setTimeout(cancel,0);
    });

    it('allSettled is cancelable', (done) => {
        const cancel = executeRunnable(
            allSettled([timeout(500), timeout(500), timeout(500)]),
            () => {},
            (error) => {
                expect(error.name).toBe('CanceledError');
                done();
            }
        );
        setTimeout(cancel,0);
    });

    it('semaphore',async ()=>{
        const sph = new Semaphore(3);

        task(function*(){
            yield* sph.waitOne();
            yield* sph.waitOne();
            expect(sph.free).toBe(true);
            yield* delay(1000);
            sph.release();
            sph.release();

        })();

        await task(function*(){
            yield* sph.waitOne();
            expect(sph.free).toBe(false);
            yield* sph.waitOne();
            expect(sph.free).toBe(true);
            sph.release();
        })();
    });
});
