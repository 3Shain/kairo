<template>
  <div>
    <p ref="para">{{ viewProp }}</p>
    <button @click="onClick">{{ count }}</button>
    <case-1-child :count="doubled" />
  </div>
</template>

<script lang="ts" setup kairo>
import '@testing-library/jest-dom';
import { watchEffect } from 'vue';
import { reference, mut, lifecycle, computed } from 'kairo';
import Case1Child from './Case1Child.vue';

const prop = defineProps({
  initialize: Function,
  clean: Function,
  viewProp: String,
  viewPropChanged: Function,
});

const para = reference<HTMLParagraphElement>(null);

lifecycle(() => {
  prop.initialize();
  expect(para.current).toBeInTheDocument();

  return () => {
    prop.clean();
  };
});

watchEffect(() => {
  prop.viewProp;
  prop.viewPropChanged();
});

const [count, setCount] = mut(0);

const doubled = computed(() => count.value * 2);

const onClick = () => {
  setCount(count.value + 1);
}
</script>
