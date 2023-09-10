import { Cell } from './cell';
import { Stateful } from './concern';
import type { ReactorFunction,GetReactorStateType } from './reactor';
import { Machine } from './reactor';

export function defineReactor<Init,M extends ReactorFunction<any,Init>>(init:Init, fn: M): Cell<GetReactorStateType<M>> {

  const machine = new Machine(fn,init);

  throw 'Ops';
}


export function* Reactor(): Generator<Stateful,any> {

}
