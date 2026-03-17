import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: '/nature-risk/app/',
  build: {
    outDir: 'dist',
    target: 'esnext',
    assetsInlineLimit: 0,
  },
  server: {
    port: 3000,
    host: true,
  },
  optimizeDeps: {
    exclude: ['nature-risk-physics'],
  },
});
