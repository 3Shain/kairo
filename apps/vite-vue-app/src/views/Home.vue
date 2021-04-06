<template>
  <div class="home">
    <!-- <HelloWorld msg="Welcome to Your Vue.js + TypeScript App" /> -->
    <Component>
     
      <HelloWorld msg="Welcome to Your Vue.js + TypeScript App" />
    </Component>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import HelloWorld from '../components/HelloWorld.vue';
import Component from '../components/Test.tsx';

export default defineComponent({
  name: 'Home',
  components: {
    HelloWorld,
    Component
  }
});
</script>
