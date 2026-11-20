/**
 * FILE: apps/web/vite.config.ts
 *
 * PURPOSE:
 * Configures the FLASHLIVE React development server and production build.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes Vite plugins, path aliases and API proxy behavior.
 *
 * HOW IT WORKS:
 * Uses React plugin, resolves @ to src, and proxies /api and /socket.io to the
 * local API during development.
 *
 * USED BY:
 * npm run dev and npm run build inside apps/web.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': srcPath,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/sites': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
