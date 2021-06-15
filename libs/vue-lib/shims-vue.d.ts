declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  // eslint-disable-next-line
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare const __DEV__: boolean;
declare const __TEST__: boolean;
