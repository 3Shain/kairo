<template>
  <div>
    <button @click="minus()">minus</button>
    <span> {{ count }} </span>
    <button @click="plus()">plus</button>
    <span>{{ outCount }}</span>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { mutable, reduced, stream } from 'kairo';
import { setupKairo } from '@kairo/vue';

export default defineComponent({
  name: 'HelloWorld',
  props: {
    msg: String,
    count: Number,
  },
  setup: setupKairo(function (props, useProp, { emit }) {
    const outCount = useProp((x) => x.count!);

    const [plusEnv, plus] = stream<number>();

    const count = reduced(plusEnv, (a, b) => a + b, 0);

    return {
      plus: () => plus(1),
      minus: () => plus(-1),
      count,
      outCount,
    };
  }),
});
</script>
<style scoped></style>
