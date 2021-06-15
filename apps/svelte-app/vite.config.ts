import { defineConfig } from 'vite';
import svelte from '@sveltejs/vite-plugin-svelte';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [svelte(), tsconfigPaths()],
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
  },
  build: {
    target: 'esnext',
    polyfillDynamicImport: false,
  },
});
