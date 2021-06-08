<script kairo>
    import { effect, inject } from 'kairo';
    import { TOKEN } from './lib';

    export let prop = 0;
    
    console.log('tile');

    effect(() => {
        return () => {
            console.log('I disposed');
        };
    });


    $: {
        console.log('aaaaaaa ' + prop);
    }

    const count = inject(TOKEN);
</script>

<h1>
    Halo~~~~~ {$count} {prop}
</h1>
