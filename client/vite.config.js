import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 6001,
    // Lets the app call /api/* on the same origin, so there is no API base URL to configure.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
