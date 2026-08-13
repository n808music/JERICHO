import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  server: {
    port: 5183,
    strictPort: true,
    // syncService.js issues same-origin /api requests in the browser and relies
    // on this proxy to reach the FastAPI backend without tripping CORS.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
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
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: false },
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.join(__dirname, 'tests/setup.ts')],
    include: [
      path.join(__dirname, 'src/**/*.{test,spec}.{js,jsx,ts,tsx}'),
      path.join(__dirname, 'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'),
    ],
  },
});
