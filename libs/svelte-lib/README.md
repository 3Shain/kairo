# @kairo/svelte

Svelte 3 integration for kairo.

> This integration is for Svelte 3 with Typescript only.

## Installation

```sh
yarn add kairo @kairo/svelte

# if you use npm
npm install kairo @kairo/svelte
```

Then in your `svelte.config.js` or `rollup.config.js`, add a preprocessor

```js
const sveltePreprocess = require('svelte-preprocess'); // you probably have been using this
const { kairo } = require('@kairo/svelte/transformer');

...
{
    preprocess: sveltePreprocess({
        ...kairo()
    })
}
...

/*
 * `kairo()` can receive a parameter described here: https://github.com/sveltejs/svelte-preprocess/blob/main/docs/preprocessing.md#typescript
 *
 * If you're using a custom transformer for typescript, pass it like this. Ignore this if you don't know.
 */
kairo({
    transformer: ({content, attributes}) => {
        // your typescript transformer (e.g. esbuild)
    }
})

```

Now you can use kairo with svelte by adding a new attribute `kairo`. Use `kairo="root"` at your root component (usually named `<App/>`), and for ordinary components just add `kairo` or `kairo=true`. Except for root component, you don't need to add this attribute if you use no kairo functions in that component.

```html
<script lang="ts" kairo="root">
    import { mutable } from 'kairo';
    const [counter, setCount] = mutable(0);
</script>
<div>
    <button on:click="{()=>setCount(counter.value + 1)}">{$count}</button>
</div>
```

## Behavior is a readable store

You can directly use Behavior objects in your template by adding $ prefix. Behavior implemented `subscribe()` method but you should avoid using it directly. Use `.watch()` insead if you want a similar feature.

Notice `$behavior` and `behavior.value` are different. Previous one provides reactivity in template, while `.value` just gives the current value. (In case you are migrating from other framework integrations)

## Props and reactive values

It's a common pattern to convert a svelte reactive value to kairo Behavior. Thanks to `$:` statement this is pretty simple.

```ts
export let prop: PropType;

const [propBeh, setProp] = mutable(prop);
$: setProp(prop);
```

Not just props, you can use the same pattern for any other reactive values. But bear in mind it's not a good idea to mix svelte syntax with kairo apis.

## Two-way bindings

It's strongly discouraged to use two-way bindings with kairo, as it will make things unpredictable (that is what kairo tries to solve). In fact two-way binding is broken in kairo-attributed component (and not easy to solve), but there are some exceptions you definitely need this like get element reference. So there is a workaround: you need to add double dollar `$$` after the variable you want to do two-way binding:

```html
<script lang="ts" kairo>
    ...
    let button$$: HTMLButtonElement;

    onMount(()=>{
        // access button$$ here
    })

    $: {
        // you can access button$$ here as well, like assign it to a Behavior
    }
    ...
</script>
<button bind:this="{button$$}"></button>
```

You can try to remove $$ and see what's happening (Answer: you will get `undefined`).

For data two-way binding you can still take the same approach but please just prevent to use it as much as you can.

And you should avoid naming variables like this if you don't need two-way binding.

## Dependency injection

`provide` and `inject` are guaranteed to work. It could be seen as an alternative of `getContext()/setContext()` and you are encouraged to use kairo's api more.

Unlike other framework integration, there is no hook/composition api/service provided for svelte to access injections in non-kairo scope, because it is really convenient to use kairo in svelte : add `kairo` attribute on your component's script tag and it just works!


## Caveats:

* Two-way binding is broken, unless naming with $$ suffix
* Source map is likely to be broken

These problem might be solved by rewriting the transformer with babel (and get Javascript support). I'm still researching on this.