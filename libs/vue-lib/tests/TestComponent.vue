<template>
  <div>Hello</div>
</template>
<script lang="ts">
import { setupKairo } from './../src';

export default {
  setup: setupKairo(() => {
    return {};
  }),
};
</script>
