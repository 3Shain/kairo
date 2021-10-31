<template>
  <div>
    <keep-alive>
      <keep-alive-child v-if="show"></keep-alive-child>
    </keep-alive>
  </div>
</template>
<script lang="ts" kairo>
import KeepAliveChild from './KeepAliveChild.vue';
export default {
  components: { KeepAliveChild },
  props: {
    show: {
      type: Boolean,
    },
  },
};
</script>
