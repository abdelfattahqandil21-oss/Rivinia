import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4308';

export default defineConfig({
  testDir: './e2e/theme-visual',
  fullyParallel: false,
  workers: 1,
  timeout: 25_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-theme-visual-report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'pnpm exec ng serve theme-visual-e2e --host 127.0.0.1 --port 4308',
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
