import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envDir: '../../',
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 4176,
    strictPort: true
  },
  build: {
    target: 'es2022'
  }
});
