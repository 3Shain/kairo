<script lang="ts" kairo>
  /// <reference types="jest" />
  import '@testing-library/jest-dom';
  import { reference, mut, effect } from 'kairo';
  import Case1Child from './Case1Child.svelte';
  const para = reference<HTMLParagraphElement>(null);

  export let initialize: Function;
  export let clean: Function;
  export let viewProp: number;
  export let viewPropChanged: Function;

  effect(() => {
    initialize();
    expect(para.current).toBeInTheDocument();

    return () => {
      clean();
    };
  });

  const [viewProp$, setVp] = mut(viewProp);
  $:{
      setVp(viewProp);
  }
  effect(() =>
    viewProp$.watch(() => {
      viewPropChanged();
    })
  );

  const [count, setCount] = mut(0);

  const doubled = count.map((x) => x * 2);

</script>

<div>
  <p bind:this={para.bind}>{viewProp}</p>
  <button
    on:click={() => {
      setCount(count.value + 1);
    }}>{$count}</button
  >
  <Case1Child count={$doubled} />
</div>
