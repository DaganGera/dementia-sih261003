import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173', viewport: { width: 412, height: 915 }, actionTimeout: 15_000 },
  webServer: { command: 'pnpm preview', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
});
