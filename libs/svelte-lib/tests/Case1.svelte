<script lang="ts" kairo>
  /// <reference types="jest" />
  import '@testing-library/jest-dom';
  import { reference, mut, lifecycle, computed } from 'kairo';
  import Case1Child from './Case1Child.svelte';
  const para = reference<HTMLParagraphElement>(null);
  export let initialize: Function;
  export let clean: Function;
  export let viewProp: number;
  export let viewPropChanged: Function;

  lifecycle(() => {
    initialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      clean();
    };
  });

  $: {
    viewPropChanged(viewProp);
  }

  const [count, setCount] = mut(0);

  const doubled = computed(() => count.value * 2);
</script>

<div>
  <p bind:this={para.bind}>{viewProp}</p>
  <button
    on:click={() => {
      setCount(c => c + 1);
    }}>{$count}</button
  >
  <Case1Child count={$doubled} />
</div>
