<template>
  <span>{{dp}}</span>
</template>
<script lang="ts">
import { setupKairo } from '../src';
// import 'jest';

export default {
  props:{
    count:Number
  },
  setup: setupKairo((_,useProp) => {
    const dp = useProp(x=>x.count);

    return {
      dp
    };
  }),
};
</script>
