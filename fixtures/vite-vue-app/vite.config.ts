import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import vueJsx from '@vitejs/plugin-vue-jsx';
// import kairoVueSFC from 'vite-plugin-kairo-vue';
// import kairoVue from '../../packages/vite-plugin-vue/src';
import kairoVue from '../../dist/packages/vite-plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
  },
  plugins: [kairoVue(), vueJsx(), tsconfigPaths()],
});
