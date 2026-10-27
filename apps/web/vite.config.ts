import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  // lê VITE_* do mesmo .env da raiz do projeto
  envDir: '../../',
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
