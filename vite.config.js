import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/pipeline': 'http://localhost:3000',
      '/state': 'http://localhost:3000',
      '/goals': 'http://localhost:3000',
      '/identity': 'http://localhost:3000',
      '/tasks': 'http://localhost:3000'
    }
  }
});
