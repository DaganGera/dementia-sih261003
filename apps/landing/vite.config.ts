import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/** Fills %TOKENS% in every HTML page. The build fails when SITE_ORIGIN is missing, so canonical and social links are never wrong. */
function tokens(command: string): Plugin {
  const origin = process.env.SITE_ORIGIN?.replace(/\/$/, '');
  if (command === 'build' && !origin) throw new Error('SITE_ORIGIN is not set. Set it to the public address of the site, for example http://localhost:4174 for a local build.');
  const values: Record<string, string> = {
    SITE_ORIGIN: origin ?? 'http://localhost:4174',
    APP_URL: process.env.APP_URL ?? '/app/',
    CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? '',
    REPO_URL: process.env.REPO_URL ?? '',
  };
  return {
    name: 'hillpath-tokens',
    transformIndexHtml: (html) => html.replace(/%([A-Z_]+)%/g, (m, k: string) => values[k] ?? m),
  };
}

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [react(), tailwindcss(), tokens(command)],
  define: {
    __APP_URL__: JSON.stringify(process.env.APP_URL ?? '/app/'),
    __CONTACT_EMAIL__: JSON.stringify(process.env.CONTACT_EMAIL ?? ''),
    __REPO_URL__: JSON.stringify(process.env.REPO_URL ?? ''),
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        privacy: resolve(__dirname, 'privacy/index.html'),
        limitations: resolve(__dirname, 'limitations/index.html'),
        credits: resolve(__dirname, 'credits/index.html'),
        offline: resolve(__dirname, 'offline/index.html'),
        notFound: resolve(__dirname, '404.html'),
      },
    },
  },
  server: { port: 4174 },
}));
