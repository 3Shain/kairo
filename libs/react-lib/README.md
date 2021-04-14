# @kairo/react

React integration for kairo.

## HoC `withKairo`

```ts
import { mutable } from 'kairo';
import { withKairo } from '@kairo/react';

const Component = withKairo(() => {
    const [count, setCount] = mutable(0);

    return () => (
        <button onClick={() => setCount(count.value + 1)}>{count.value}</button>
    );
});
```

The function warpped in `withKairo` will execute **only one time**.

The return value is the real render function.

The first parameters are properties object.

### Access properties

```ts
withKairo<{
    prop1: number,
    prop2: string
}>((props, useProp)=>{

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
```

### Access children

```ts
withKairo(()=>{

    ...

    return ({ children }) =>
    (<div>
        { children }
    </div>)
});
```

## Why dependency injection?

## Hook `useInject`

It's not necessary to 'kairo' all components, like presentational components that only care about props. Thus you can use `useInject` hook.

It works almost the same as `inject`, but you can
