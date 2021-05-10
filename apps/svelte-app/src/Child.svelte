<script lang="ts" kairo>
    import { effect, inject } from 'kairo';
    import { TOKEN } from './lib';

    export let prop: number = 0;
    console.log(prop);

    effect(() => {
        return () => {
            console.log('I disposed');
        };
    });

    $: {
        console.log('www ' + prop);
    }

    const count = inject(TOKEN);
</script>

<h1>
    Halo~~~~~ {$count}
    {prop}
</h1>
