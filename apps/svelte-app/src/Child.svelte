<script lang="ts" kairo>
import { inject, registerDisposer } from "kairo";
import { TOKEN } from "./lib";

export let prop: number = 0;

registerDisposer(()=>{
    console.log('I disposed');
})

$: {
    console.log("www "+prop);
}

const count = inject(TOKEN);

</script>
<h1>
    Halo~~~~~ {$count} {prop}
</h1>