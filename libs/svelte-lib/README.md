# @kairo/svelte

Svelte 3 integration for kairo.

## Installation

```sh
yarn add kairo @kairo/svelte

# if you use npm
npm install kairo @kairo/svelte
```

Then in your `svelte.config.js` or `rollup.config.js`, add a preprocessor.

```js
const sveltePreprocess = require('svelte-preprocess'); // you probably have been using this
const { kairo } = require('@kairo/svelte/transformer');

...
{
    preprocess: sveltePreprocess({
        'babel':kairo({
            //...If you currently have babel configurations,
            // you can directly pass in them here.
        })
    })
}

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

Notice `$behavior` and `behavior.value` are different. Previous one provides reactivity in template, while `.value` just gives the current value. (In case you are migrating from other framework integrations of kairo)

## Props and reactive values

It's a common pattern to convert a svelte reactive value to kairo Behavior. Thanks to `$:` statement this is pretty simple.

```ts
export let prop: PropType;

const [propBeh, setProp] = mut(prop);
$: setProp(prop);
```

Not just props, you can use the same pattern for any other reactive values. But bear in mind it's a really bad idea to mix svelte syntax with kairo apis.

## Two-way bindings

It's strongly discouraged to use two-way bindings with kairo, as it will make things unpredictable (that is what kairo aimed to solve). However there are some cases you have to use it, e.g. get DOM element references.

```html
<script lang="ts" kairo>
  ...
  let button$$: HTMLButtonElement;
  // it's recommended to add double-dollar marks to warn you it's a two-way binding.
  ...
</script>
<button bind:this="{button$$}"></button>
```

## Dependency injection

`provide` and `inject` are guaranteed to work. It could be seen as an alternative of `getContext()/setContext()` and you are encouraged to use kairo's api more.

Unlike other framework integration, there is no hook/composition api/service provided for svelte to access injections in non-kairo scope, because it is so convenient to use kairo in svelte : add `kairo` attribute on your component's script tag and it just works!
