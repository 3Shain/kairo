import { Stateful } from "./concern";

interface ReducerFunction<State,Action> {
  (action:Action, state:State): State;
}


export function defineReducer<State,Action>(
  source: any, //Cell|Event
  initial: State,
  reducer = identity,
  errorReducer = identityThrow
) {

}

export function* Reducer<State,Action>(
  source: any, //Cell|Event
  initial: State,
  reducer = identity,
  errorReducer = identityThrow
): Generator<Stateful,any> {
  yield {
    feature: 'state-allocation',
    hook: ()=>{
      return ()=>{

      }
    }
  }
}

const identity = <T>(s:T)=>s;
const identityThrow = (s:any) => { throw s;};
