<template>
  <span>{{ count }}</span>
  <slot></slot>
</template>
<script lang="ts">
export default {
  props: {
    count: Number
  },
};
</script>
