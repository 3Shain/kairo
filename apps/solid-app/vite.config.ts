import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [solidPlugin(),tsconfigPaths()],
  define: {
    '__DEV__': 'true',
    '__TEST__': 'true'
  },
  build: {
    target: "esnext",
    polyfillDynamicImport: false,
  },
});