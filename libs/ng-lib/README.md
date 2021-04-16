# @kairo/angular

Angular integration for kairo.

> Currently for angular version >=11, below are not tested (and likely not work as it dependes ivy `features`). Pull requests are always welcomed.

## Install

```sh
yarn add @kairo/angular kairo

# or use npm
npm install @kairo/angular kairo
```

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

And for (maybe lazy-loaded) children module, you should use `KairoModule.forChild(setupFunction)`

## Kairo Component

The most simple way to use kairo in your angular project is 'kairo-ize' your component. It can be simply done by add a decorator `@WithKairo()` above your component class.

```ts

import { WithKairo } from '@kairo/angular';

@Component({
    ...
})
@WithKairo()
export class CounterComponent {

    count: number;
    setCount: (v:number)=>void;

    ngSetup(){
        const [count,setCount] = mutable(0);

        return {
            count,
            setCount
        }
    }
}
```

As you might have noticed there is a new lifecycle method `ngSetup` (and actually there is a `Setup<TComponent>` interface for it). It is executed right after ngOnInit. You should write all your kairo logics here (a Scope is auto created), and return an object containing all values you want to bind to your view. Behavior (non-nested) will be auto unwrapped. And the view will automatically update when any binding Behavior updates.

Because angular might strictly check type definitions of template, thus you might need to add some boilerplate codes.

## Access inputs

Just declare your input property as usual
```ts
@Input()
prop: PropType;
```

Then you can access input in form of Behavior like this

```ts
class Component implements Setup<Component> {
    // let IDE help your with type definitions......
    ngSetup(useProp:<T>(selector:(comp:Component)=>T)=>Behavior<T>){
    ...

    const propBehavior: Behavior<PropType> = useProp(x=>x.prop);

    ...
}
}
```

## Access ViewChild / ContentChild

Currently you might need to do some workaround, like expose the setter of Behaviors. But there is a plan to make this like accessing props.

<!-- 
## About Angular Lifecycle Hooks

Lifecycle is generally not needed in kairo world. If you do need lifecycle hooks, you can still create an event, expose the emit function from reactive zone and call it in your lifecycle hooks.

> If you meet this situation, you probably used either kairo or lifecycle hooks in a wrong way. -->


<!-- ## Why dependency injection? -->

## `KairoScopeRef.useInject`

It's not necessary to 'kairo-ize' all components, like presentational components that doesn't have their own state. Instead you can access injected `KairoScopeRef` service and  `useInject`.

Wait, there are two systems of DI? That is ture. And the difference is Angular's DI is static, while kairo provides more flexibility (as `inject`,`provide` are just function calls).

`KairoScopeRef.useInject` works almost the same as `inject`, but it will do these things:

* If the injected value is a Behavior, then it will be transformed to a rx Observable
    ```ts
    // the token you declared (and provide it somewhere (e.g. root))
    const IS_DARK = InjectToken.for<Behavior<boolean>>("Is dark theme");
    

    // in angular component class

    constructor(private scopeRef: KairoScopeRef) {}

    value: Observable<boolean> = this.scopeRef.useInject(IS_DARK);
    ```
* If the injected value is an object containing Behavior properties, then the whole object is transformed to a rx Observable.
    ```ts
    // the token you declared (and provide it somewhere (e.g. root))
    const COUNTER = InjectToken.for<{
        count: Behavior<number>,
        add: (value:number) => void
    }>("A simple counter");

    
    // in angular component class

    constructor(private scopeRef: KairoScopeRef) {}

    counter$ = this.scopeRef.useInject(COUNTER);
    ```
    and use it in template
    ```html
    <ng-container *ngIf="counter$|async;let counter">
        <button (click)="counter.add(1)">{{counter.count}}</button>
    </ng-container>
    ```
    There is also @ngrx/components that provides *ngrxLet directive, better than use *ngIf
* Otherwise, it returns a Observable that do never changes.
