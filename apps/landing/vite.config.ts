import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Fallback defaults for hosts where build-time env vars can't be configured (e.g. no dashboard
// access to the deploying Vercel project). Real env vars, when set, always override these.
const DEFAULT_SITE_ORIGIN = 'https://mindcare-ai-three.vercel.app';
const DEFAULT_APP_URL = 'https://mindcare-ai-git-main-marcben-james-samuel-ss-projects.vercel.app/';

/** Fills %TOKENS% in every HTML page. */
function tokens(): Plugin {
  const origin = (process.env.SITE_ORIGIN ?? DEFAULT_SITE_ORIGIN).replace(/\/$/, '');
  const values: Record<string, string> = {
    SITE_ORIGIN: origin,
    APP_URL: process.env.APP_URL ?? DEFAULT_APP_URL,
    CONTACT_EMAIL: process.env.CONTACT_EMAIL ?? '',
    REPO_URL: process.env.REPO_URL ?? '',
  };
  return {
    name: 'hillpath-tokens',
    transformIndexHtml: (html) => html.replace(/%([A-Z_]+)%/g, (m, k: string) => values[k] ?? m),
  };
}

export default defineConfig(() => ({
  base: '/',
  plugins: [react(), tailwindcss(), tokens()],
  define: {
    __APP_URL__: JSON.stringify(process.env.APP_URL ?? DEFAULT_APP_URL),
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
