import { Behavior } from 'kairo';

export interface NgSetup<Component> {
    ngSetup(
        useProp: <P>(thunk: (instance: Component) => P) => Behavior<P>
    ): object;
}
