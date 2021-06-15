import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
  },
  plugins: [vue(), vueJsx(), tsconfigPaths()],
});
