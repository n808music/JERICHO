import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_API_BASE_URL controls which backend the frontend proxies to.
// Default is now FastAPI (port 8000). Override to :3000 for legacy Node.js.
const API_BASE = process.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_BASE, changeOrigin: true },
      '/health': { target: API_BASE, changeOrigin: true },
      '/pipeline': { target: API_BASE, changeOrigin: true },
      '/state': { target: API_BASE, changeOrigin: true },
      '/goals': { target: API_BASE, changeOrigin: true },
      '/identity': { target: API_BASE, changeOrigin: true },
      '/tasks': { target: API_BASE, changeOrigin: true },
      '/task-status': { target: API_BASE, changeOrigin: true },
      '/cycle': { target: API_BASE, changeOrigin: true },
      '/reset': { target: API_BASE, changeOrigin: true },
      '/ai': { target: API_BASE, changeOrigin: true },
      '/team': { target: API_BASE, changeOrigin: true },
      '/internal': { target: API_BASE, changeOrigin: true },
      '/calendar': { target: API_BASE, changeOrigin: true },
      '/rhythms': { target: API_BASE, changeOrigin: true },
      '/accountability': { target: API_BASE, changeOrigin: true },
      '/native': { target: API_BASE, changeOrigin: true },
    }
  },
  define: {
    __API_BASE__: JSON.stringify(API_BASE),
  }
});
