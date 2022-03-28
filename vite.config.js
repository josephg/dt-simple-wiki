import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // https: true,
    proxy: {
      '/braid': {
        target: 'http://localhost:4322',
        ws: true,
      }
    }
  },
  build: {
    minify: true,
    sourcemap: true,
    outDir: 'dist',
    target: 'esnext',
    polyfillDynamicImport: false,
  },
});
