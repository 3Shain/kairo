<script lang="ts" kairo>
  import { mut } from 'kairo';
  export let count: number;

  const [dp, setdp] = mut(count);

  $: {
    setdp(count);
  }

</script>

<span>{$dp}</span>
