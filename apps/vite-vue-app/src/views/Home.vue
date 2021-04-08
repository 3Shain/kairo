<template>
  <div class="home">
    <!-- <HelloWorld msg="Welcome to Your Vue.js + TypeScript App" /> -->
    <CC :test="counter">
      <HelloWorld msg="Welcome to Your Vue.js + TypeScript App" :count="counter" />
    </CC>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import HelloWorld from '../components/HelloWorld.vue';
import CC from '../components/Test';

export default defineComponent({
  name: 'Home',
  components: {
    HelloWorld,
    CC
  },
  setup: ()=>{
    const counter = ref(0);
    setInterval(()=>{
      counter.value++;
    },1000);
    return {
      counter
    }
  }
});
</script>
