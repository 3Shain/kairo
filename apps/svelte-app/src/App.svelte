<script lang="ts">
	import { setupKairo as setup } from './lib';
	export let name: string;

	$: component = name+'a';

	const {
		plus
		minus,
		count
	} = 
	setup(()=>{

	});

	
</script>

<main>
	<button>minus</button>
	<span></span>
	<button>plus</button>
</main>

<style>

</style>
