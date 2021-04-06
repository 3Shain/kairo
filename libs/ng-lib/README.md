# @kairo/angular

```ts
import { Component } from '@angular/core';
import {} from 'kairo';
import { KairoComponent } from '@kairo/angular';

@Component({
    // ... component declerations 
})
@KairoComponent()
export class FooComponent {


    ngSetup(){
        // setup logics here
    }
}
```

## Input Bindings

Just declare your input property as usual
```ts
@Input()
prop: PropType;
```

Then you can access input in form of Behavior like this

```ts
ngSetup({
    prop: Behavior<PropType>
}){
    ...

    prop //to anything you want. Changes are auto captured

    ...
}
```

## Output Bindings

Just declare your output property as usual
```ts
@Output()
customOutput = new EventEmitter<OutputType>()
```

Then you can access output property from ngSetup (reactive zone).


```ts
ngSetup(){
    ...

    listen(someEvent,(payload)=>{
        customOutput.emit(payload);
    });

    ...
}
```

Please bear in mind, emit a output IS A **SIDE EFFECT**.

## Access ViewChild


## Access ContentChild


## About Angular Lifecycle Hooks

Lifecycle is generally not needed in kairo world. If you do need lifecycle hooks, you can still create an event, expose the emit function from reactive zone and call it in your lifecycle hooks.

> If you meet this situation, you probably used either kairo or lifecycle hooks in a wrong way.