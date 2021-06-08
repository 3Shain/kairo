# @kairo/angular

Angular integration for kairo.

> Currently for angular version >=11, below are not tested (and likely not work as it dependes ivy `features`). Pull requests are always welcomed.

## Install

```sh
yarn add @kairo/angular kairo

# or use npm
npm install @kairo/angular kairo
```
<!-- 
First of all, import `KairoModule` on your root module.


```ts
// import {} from 'kairo';
import { KairoModule } from '@kairo/angular';

function globalSetup() {
    // provide your global service, state here
}

@NgModule({
    ...
    imports: [
        ...
        KairoModule.forRoot(globalSetup)
        ...
    ]
    ...
})
export class AppModule { }
```

And for (maybe lazy-loaded) child modules, you should use `KairoModule.forChild(setupFunction)`

## Kairo Component

Simply add a decorator `@WithKairo()` above your component class and extends `ngSetup(setupFunction)`.

```ts

import { WithKairo, ngSetup } from '@kairo/angular';

@Component({
    ...
})
@WithKairo()
export class CounterComponent extends ngSetup(()=>{
    const [count,setCount] = mut(0);
    return {
        count,
        setCount
    }
}) { }
```

`setup` logic is executed right before ngOnInit or first ngOnChanges. You should write all your kairo logics here (a Scope is created), and return an object containing all values you want to bind to your view. Behavior (not in nested object) will be auto unwrapped. And the view will automatically update when any binding Behavior updates.

**NB**: If `providers` or `viewProviders` are declared inside `@Component({...})`, you should move them to `@WithKairo({...})` otherwise the Angular DI would break.

## Access inputs

Just declare your input property as usual. 
Then you can access static input values from the first parameter of setup function. If a input can change over time, th

```ts
class Component extends ngSetup((props,useProp){
    const prop = props.prop1; // read static value
    const prop2 = useProp(x=>x.prop2); // read as Behavior
}) {
    @Input()
    prop1: PropType1;
    @Input()
    prop2: PropType2;
    ...
}
```

## Access ViewChild / ContentChild

Currently you might need to do some workaround, like expose the setter of Behaviors. But there is a plan to make this like accessing props.


## About Angular Lifecycle Hooks

Lifecycle is generally not needed in kairo world. If you do need lifecycle hooks, you can still create an event, expose the emit function from reactive zone and call it in your lifecycle hooks.

> If you meet this situation, you probably used either kairo or lifecycle hooks in a wrong way. 


## Why dependency injection? -->