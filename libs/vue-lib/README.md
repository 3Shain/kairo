# @kairo/vue

Vue integration for kairo.

> Currently for vue version >=3, but there should be no technical difficulty to provide support vue 2 (but might be time-consuming). Pull requests are always welcomed.

## Install

```sh
yarn add @kairo/vue kairo

# or use npm
npm install @kairo/vue kairo
```

First of all, you need to setup a global instance of kairo.

```tsx
import { kairoApp } from '@kairo/vue';

function globalSetup() {
    // write your global reactive logic, provide services here.
}

// following code should be in your entry file.
createApp(App).use(router).use(kairoApp(globalSetup));
```

If you know how dependency injection can be effective in a frontend project, then probably you've known what can you do with `provide/inject` api. But in case you've never heared about this, you can think of Context, kairo provides a similar mechanism and you can and should heavily rely on this.

To ultilize DI in kairo (not only for react), there are only 3 steps:

1. Declare a "Token".
2. Provide something on top (e.g. `kairoApp()`).
3. Inject something on bottom (any children component).

The reason for introducing dependency injection is we want `inverse of control`, which decouples logic, so your component & "hooks" (use-compositions) can be more reusable, because it dependes (and might optionally) on a token, not a specific instance.

## Kairo Component

There are two methods you can 'kairo-ize' your vue component.

### Method 1: SFC `setupKairo`

```vue
<template>
    <button @click="setCount(count + 1)">
        {{ count }}
    </button>
</template>
<script lang="ts">
import { mutable } from 'kairo';
import { setupKairo } from '@kairo/vue';

export default defineComponent({
    ... // props definitions
    setup: setupKairo(()=>{
    const [count, setCount] = mutable(0);
        return {
            count,setCount
        }
    })
})
</script>
```

### Access properties

```tsx
setupkairo((props, useProp, ctx)=>{

    const prop1 : number = props.prop1;
    /**
     * The first parameters is the object contains all properties.
     * It is _static_, designed on purpose.
     * Because for non-presentational components, props are unlikely to change.
     *
     * But if you want a 'reactive' property (i.e. you want to have a Behavior),
     * you can use the second parameter:
     */
    const prop2 : Behavior<string> = useProp(x=>x.prop2);

    ...

    return {
        ...
    }
});
```

Thid parameter is the SetupContext object.

### Method 2: HoC `withKairo` (for JSX users)

```tsx
import { mutable } from 'kairo';
import { withKairo } from '@kairo/vue';

const Component = withKairo(() => {
    const [count, setCount] = mutable(0);

    return () => (
        <button onClick={() => setCount(count.value + 1)}>{count.value}</button>
    );
});
```

The function warpped in `withKairo` will execute **exactly one time**. And the function returned is the actual render function.

As you see the `Behavior` is directly accessed in the render function. The vue integration tracks this and will update your view whenever value accessed changes.

### Access properties

```tsx
const Component = withKairo<{
    prop1: number,
    prop2: string
}>((props, useProp, ctx)=>{

    const prop1 : number = props.prop1;
    /**
     * The first parameters is the object contains all properties.
     * It is _static_, designed on purpose.
     * Because for non-presentational components, props are unlikely to change.
     *
     * But if you want a 'reactive' property (i.e. you want to have a Behavior),
     * you can use the second parameter:
     */
    const prop2 : Behavior<string> = useProp(x=>x.prop2);

    ...

    return () => ...
});

// NB: you need to declare props separately!
Component.props = ["prop1","prop2"]

```

Thid parameter is the SetupContext object.

<!-- You can also directly read props in the render function, if you just want to pass them to the view.

```ts
withKairo<{
    prop1: number,
    prop2: string
}>(()=>{

    ...

    return ({prop1,prop2}) => ...
});
``` -->

### Access children

```tsx
withKairo(()=>{

    ...

    return ({ children }) =>
    (<div>
        { children }
    </div>)
});

// for slots$

withKairo(()=>{

    ...

    return function(this:ComponentPublicInstance){
        return (<div>
        { renderSlot(this.$slots, 'default') }
        </div>)
        }
});
```

<!-- ## Why dependency injection? -->

## Composition api `useInject`

It's not necessary to 'withKairo' all components, like presentational components that doesn't have their own state. Instead you can use `useInject` vca.

It works almost the same as `inject`, but the vue integration will do these things:

-   If the injected value is a Behavior, then it will be transformed to a vue Ref, and schedule updates when the Behavior changes.

    ```ts
    // the token you declared (and provide it somewhere (e.g. root))
    const IS_DARK = InjectToken.for<Behavior<boolean>>('Is dark theme');

    // in your vue component setup()

    const value: Ref<boolean> = useInject(IS_DARK);
    ```

-   If the injected value is an object containing Behavior properties, then the whole object is transformed to a vue reactive object, and shedule updates when any Behavior changes.

    ```ts
    // the token you declared (and provide it somewhere (e.g. root))
    const COUNTER = InjectToken.for<{
        count: Behavior<number>;
        add: (value: number) => void;
    }>('A simple counter');

    // in your vue component setup()

    const counter = useInject(COUNTER); // the 'counter' is created by reactive()
    ```

-   Otherwise, it returns the inected value.
