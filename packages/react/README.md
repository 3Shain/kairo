# @kairo/react

React integration for kairo.

## Component `KairoApp`

First of all, you need to wrap your `<App/>` inside `<KairoApp>`

```tsx
function globalSetup() {
  // write your global reactive logic, provide services here.
}

render(
  <KairoApp globalSetup={globalSetup}>
    <App />
  </KairoApp>,
  document.getElementById('root')
);
```

If you know how dependency injection can be effective in a frontend project, then probably you've known what can you do with `provide/inject` api. But in case you've never heared about this, you can think of Context, kairo provides a similar mechanism and you can and should heavily rely on this.

To ultilize DI in kairo (not only for react), there are only 3 steps:

1. Declare a "Token".
2. Provide something on top (e.g. `<KairoApp>`).
3. Inject something on bottom (any children component).

The reason for introducing dependency injection is we want `inverse of control`, which decouples logic, so your component & "hooks" (use-compositions) can be more reusable, because it dependes (and might optionally) on a token, not a specific instance.

## HoC `withKairo`

```tsx
import { mutable } from 'kairo';
import { withKairo } from '@kairo/react';

const Component = withKairo(() => {
  const [count, setCount] = mutable(0);

  return () => (
    <button onClick={() => setCount(count.value + 1)}>{count.value}</button>
  );
});
```

The function warpped in `withKairo` will execute **exactly one time**. And the function returned is the actual render function. That is to say, you could continue using your hooks.

As you see the `Behavior` is directly accessed in the render function. The react integration tracks this and will update your view whenever value accessed changes.

### Access properties

```tsx
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

You can also directly read props in the render function, if you just want to pass them to the view.

```ts
withKairo<{
    prop1: number,
    prop2: string
}>(()=>{

    ...

    return ({prop1,prop2}) => ...
});
```

### Access children

```tsx
withKairo(()=>{

    ...

    return ({ children }) =>
    (<div>
        { children }
    </div>)
});
```

<!-- ## Why dependency injection? -->

## Hook `useInject`

It's not necessary to 'withKairo' all components, like presentational components that doesn't have their own state. Instead you can use `useInject` hook.

It works almost the same as `inject`, but the react integration will do these things:

- If the injected value is a Behavior, then it will be unwrapped, and schedule updates when the Behavior changes.

  ```ts
  // the token you declared (and provide it somewhere (e.g. root))
  const IS_DARK = InjectToken.for<Behavior<boolean>>('Is dark theme');

  // in your functional components

  const value: boolean = useInject(IS_DARK);
  ```

- If the injected value is an object containing Behavior properties, then these properties will be unwrapped, and shedule updates when any Behavior changes.

  ```ts
  // the token you declared (and provide it somewhere (e.g. root))
  const COUNTER = InjectToken.for<{
    count: Behavior<number>;
    add: (value: number) => void;
  }>('A simple counter');

  // in your functional components

  const {
    count, // it's a number!
    add, // and it's a function
  } = useInject(COUNTER);
  ```

- Otherwise, it returns the inected value.
