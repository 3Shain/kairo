<template>
  <div>
    <p ref="para">{{viewProp}}</p>
    <button @click="onClick">{{count}}</button>
    <case-1-child :count="doubled"/>
  </div>
</template>
<script lang="ts">
/// <reference types="jest" />
import '@testing-library/jest-dom';
import { reference, mut, lifecycle } from 'kairo';
import Case1Child from './Case1Child.vue';

export default {
  props: {
    initialize: Function,
    clean: Function,
    viewProp: String,
    viewPropChanged: Function,
  },
  components: {
    Case1Child
  },
  setup: ((prop, useProp) => {
    const para = reference<HTMLParagraphElement>(null);

    lifecycle(() => {
      prop.initialize();
      expect(para.current).toBeInTheDocument();

      return () => {
        prop.clean();
      };
    });

    // const viewProp = useProp((x) => x.viewProp);
    // lifecycle(() =>
    //   viewProp.watch(() => {
    //     prop.viewPropChanged();
    //   })
    // );

    const [count, setCount] = mut(0);

    const doubled = count.map((x) => x * 2);

    return {
      count,
      doubled,
      para,
      onClick:()=>{
        setCount(count.value + 1);
      }
    };
  }),
};
</script>
