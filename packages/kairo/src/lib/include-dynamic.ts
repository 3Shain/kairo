import { Cell } from './cell';
import { AnyImplementation, FeaturesOf, ImplementationOf, IncludeMany } from './concern';

function* IncludeDynamic<T extends AnyImplementation>(impl: Cell<T>):Generator<any,Cell<any>> {
  // get impl
  const context = (yield 'CONTEXT' as never) as any;

  // initial impl
  /**
   * context and effect is captured
   * while state lifecycle is self managed
   */

  // update

  /**
   * context and effect are managed standalone
   * as well as state...
   */

  throw 'Oops';
}

function* IncludeManyDynamic<T extends AnyImplementation>(impl: Cell<T>):Generator<any,Cell<any>> {
  const context = (yield 'CONTEXT' as never) as any;

  //

  throw 'Oops';
}

function* IncludeDynamicMany<T extends Cell<AnyImplementation>[]>(...args:T) {
  return yield* IncludeMany(...args.map(x=>createDummyImpl(x)))
}

function createDummyImpl<T extends AnyImplementation>(x:Cell<T>): ImplementationOf<any,FeaturesOf<T>,{}> {
  return new ImplementationOf(null as any, function*(){
    return yield* IncludeDynamic(x);
  });
}
