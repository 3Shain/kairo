<script lang="ts" kairo true>
    import { inject, registerDisposer } from 'kairo';
    import { TOKEN } from './lib';

    export let prop: number = 0;
    console.log(prop);

    registerDisposer(() => {
        console.log('I disposed');
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
