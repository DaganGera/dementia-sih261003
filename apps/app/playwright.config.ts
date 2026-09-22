import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 412, height: 915 },
    actionTimeout: 15_000,
    // Autoplay for sounds, and real addresses in WebRTC candidates so two browser contexts on one machine can connect.
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=WebRtcHideLocalIpsWithMdns'] },
  },
  webServer: [
    { command: 'pnpm preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm --filter relay local', url: 'http://localhost:8787/v1/health', reuseExistingServer: true, timeout: 60_000 },
  ],
});
