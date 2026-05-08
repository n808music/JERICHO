import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  root: '.',
  define: {
    process: {
      env: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        JERICHO_DISABLE_GENERATE_TRACE: process.env.JERICHO_DISABLE_GENERATE_TRACE || '',
        JERICHO_DEBUG_PERF_ACTIONS: process.env.JERICHO_DEBUG_PERF_ACTIONS || '',
        JERICHO_DEBUG_SCHEDULER: process.env.JERICHO_DEBUG_SCHEDULER || '',
        VITE_REDUCE_UI: process.env.VITE_REDUCE_UI || '',
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      src: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src'),
    },
  },
  test: {
    threads: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
});
