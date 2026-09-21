import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4174', viewport: { width: 1440, height: 900 } },
  webServer: { command: 'pnpm preview', url: 'http://localhost:4174', reuseExistingServer: true, timeout: 60_000 },
});
