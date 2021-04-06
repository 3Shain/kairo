<template>
  <div>
    <button @click="minus()">minus</button>
    <span> {{ count }} </span>
    <button @click="plus()">plus</button>
    <span>{{ msg }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { data, stream } from 'kairo';
import { setupKairo } from '@kairo/vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: String,
  },
  setup: setupKairo(({ msg }) => {
    const [plusEnv, plus] = stream<number>();

    const count = plusEnv.reduce((a, b) => a + b, 0);

    return {
      plus: () => plus(1),
      minus: () => plus(-1),
      count,
      msg
    };
  }),
});
</script>
<style scoped>
</style>
