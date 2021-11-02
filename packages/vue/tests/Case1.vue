<template>
  <div>
    <button @click="onClick">{{ count }}</button>
    <case-1-child :count="doubled">
      <p :ref="bindpara.bind">{{ viewProp }}</p>
    </case-1-child>
  </div>
</template>
<script lang="ts" kairo>
import '@testing-library/jest-dom';

import { watchEffect } from 'vue';
import { reference, mut, lifecycle, computed } from 'kairo';

import Case1Child from './Case1Child.vue';
import { withConcern } from '../src';

export default {
  props: {
    initialize: Function,
    clean: Function,
    viewProp: String,
    viewPropChanged: Function,
  },
  components: {
    Case1Child: withConcern(()=>{},Case1Child as any )
  },
  setup: ((prop) => {
    const [para,bindpara] = reference<HTMLParagraphElement>(null);
    
    lifecycle(() => {
      prop.initialize();
      expect(para.current).toBeInTheDocument();

      return () => {
        prop.clean();
      };
    });

    watchEffect(()=>{
      prop.viewProp;
      prop.viewPropChanged();
    });

    const [count, setCount] = mut(0);

    const doubled = computed(($) => $(count) * 2);

    return {
      count,
      doubled,
      bindpara,
      onClick: () => {
        setCount(count.value + 1);
      }
    };
  }),
};
</script>
