import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // reachable from a phone or iPad on the same Wi-Fi
    proxy: {
      // xfwd passes the real visitor's IP to the API (X-Forwarded-For), so the activity log can show it
      '/api': { target: 'http://localhost:5000', xfwd: true },
    },
  },
});
