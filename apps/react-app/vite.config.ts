import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import reactRefresh from '@vitejs/plugin-react-refresh';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __DEV__: 'true',
    __TEST__: 'true',
  },
  plugins: [tsconfigPaths(), reactRefresh()],
});
