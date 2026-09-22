import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      injectRegister: 'script',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'] },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
  server: { host: true, port: 5173 },
});
