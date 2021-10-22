import { task, delay, timeout } from './task';
import { ControlStatements as cs } from './control-statements';

describe('concurrency/control-statements', () => {
  describe('while()', () => {
    it('should exit when condition is false', async () => {
      const end = jest.fn();
      await task(function* () {
        yield* cs.while(
          () => false,
          function* () {
            throw 'never';
          }
        );
        end();
      })();
      expect(end).toBeCalledTimes(1);
    });

    it('should exit whole loop when break', async () => {
      const end = jest.fn();
      await task(function* () {
        yield* cs.loop(function* () {
          yield* cs.break();
          throw 'never';
        });
        end();
      })();
      expect(end).toBeCalledTimes(1);
    });

    it('should async exit whole loop when break', async () => {
      const end = jest.fn();
      await task(function* () {
        yield* cs.loop(function* () {
          yield* delay();
          yield* cs.break();
          throw 'never';
        });
        end();
      })();
      expect(end).toBeCalledTimes(1);
    });

    it('should exit current loop when continue', async () => {
      const end = jest.fn();
      await task(function* () {
        let cond = 5;
        yield* cs.while(
          () => cond > 0,
          function* () {
            cond--;
            yield* cs.continue();
            end();
          }
        );
      })();
      expect(end).toBeCalledTimes(0);
    });

    it('should async exit current loop when continue', async () => {
      const end = jest.fn();
      await task(function* () {
        let cond = 5;
        yield* cs.while(
          () => cond > 0,
          function* () {
            yield* delay();
            cond--;
            yield* cs.continue();
            end();
          }
        );
      })();
      expect(end).toBeCalledTimes(0);
    });

    it('should exit whole task when return', async () => {
      const end = jest.fn();
      const ret = await task(function* () {
        yield* cs.loop(function* () {
          yield* cs.return(0);
        });
        end();
        return -1; // stub
      })();
      expect(end).toBeCalledTimes(0);
      expect(ret).toBe(0);
    });

    it('should async exit whole task when return', async () => {
      const end = jest.fn();
      const ret = await task(function* () {
        yield* cs.loop(function* () {
          yield* delay();
          yield* cs.return(0);
        });
        end();
        return -1; // stub
      })();
      expect(end).toBeCalledTimes(0);
      expect(ret).toBe(0);
    });

    it('should propagate error', async () => {
      const ret = await task(function* () {
        try {
          yield* cs.loop(function* () {
            throw 0;
          });
        } catch (e) {
          return e;
        }
      })();
      expect(ret).toBe(0);
    });

    it('should async propagate error', async () => {
      const ret = await task(function* () {
        try {
          yield* cs.loop(function* () {
            yield* delay();
            throw 0;
          });
        } catch (e) {
          return e;
        }
      })();
      expect(ret).toBe(0);
    });

    // it('should exit when condition is false', async ()=>{
    //     const end = jest.fn();
    //     await task(function*(){

    //     })();
    //     expect(end).toBeCalledTimes(1);
    // });

    // it('should exit when condition is false', async ()=>{
    //     const end = jest.fn();
    //     await task(function*(){

    //     })();
    //     expect(end).toBeCalledTimes(1);
    // });
  });

  describe('select()', () => {
    it(
      'should pass even if no cases',
      task(function* () {
        yield* cs.select;
      })
    );

    it(
      'should go default',
      task(function* () {
        const f = jest.fn();
        yield* cs.select
          .case(delay(1), function* () {
            throw 'never';
          })
          .default(function* () {
            f();
          })
          .case(delay(2), function* () {
            throw 'never';
          });
        expect(f).toBeCalledTimes(1);
      })
    );

    it(
      'should execute the first fulfilled task',
      task(function* () {
        const f = jest.fn();
        yield* cs.select
          .case(delay(10), function* () {
            throw 'never';
          })
          .case(delay(20), function* () {
            throw 'never';
          })
          .case(delay(0), function* () {
            f();
          });
        expect(f).toBeCalledTimes(1);
      })
    );

    it(
      'should throw when first async throw',
      task(function* () {
        const f = jest.fn();
        try {
          yield* cs.select
            .case(delay(10), function* () {
              throw 'never';
            })
            .case(delay(20), function* () {
              throw 'never';
            })
            .case(timeout(0), function* () {
              f();
            });
          throw 'never';
        } catch (e) {
          expect(f).toBeCalledTimes(0);
        }
      })
    );

    it(
      'should throw when first immediately throw',
      task(function* () {
        const f = jest.fn();
        try {
          yield* cs.select
            .case(
              (function* () {
                throw 'error';
              })(),
              function* () {
                f();
              }
            )
            .case(delay(10), function* () {
              throw 'never';
            })
            .case(delay(20), () => {
              throw 'never';
            });
          throw 'never';
        } catch (e) {
          expect(f).toBeCalledTimes(0);
        }
      })
    );
  });
});
