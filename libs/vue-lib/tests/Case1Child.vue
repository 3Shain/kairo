<template>
  <span>{{ dp }}</span>
</template>
<script lang="ts">
// import 'jest';

export default {
  props: {
    count: Number
  },
  setup: ((_, useProp) => {
    const dp = useProp(x => x.count);

    return {
      dp
    };
  }),
};
</script>
