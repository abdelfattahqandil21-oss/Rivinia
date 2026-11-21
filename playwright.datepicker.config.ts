import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/datepicker',
  testMatch: 'datepicker-integration.spec.ts',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4399', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/serve.mjs dist/theme-compat-e2e/plain/browser 4399',
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
