import { defineConfig } from '@playwright/test';

/**
 * E2E smoke tests — `npm run test:e2e`. Kept out of the unit suite (vitest
 * scans tests/; Playwright scans e2e/). Reuses a running dev server on 5180
 * (the project's pinned port) or starts one.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    port: 5180,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
