<script lang="ts" kairo>
    import { inject, mutable, provide, stream } from 'kairo';
    import Child from './Child.svelte';
    import { TOKEN } from './lib';

    export let name: string = '255';

    const [event, plus] = stream<number>();
    const count = event.reduce((a, b) => a + b, 0);

    $: {
        console.log($count);
    }

    provide(TOKEN, count);
</script>

<main>
    <button on:click={(e) => plus(-1)}>minus</button>
    {$count}
    <button on:click={(e) => plus(1)}>plus</button>

    {#if $count % 100}
        <Child prop={$count + 100}/>
    {/if}
</main>

<style>
</style>
