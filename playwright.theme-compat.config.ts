import { defineConfig, devices } from '@playwright/test';

const configuration = process.env['RV_THEME_CONFIG'] ?? 'plain';
const baseURL = 'http://127.0.0.1:4399';

export default defineConfig({
  testDir: './e2e/theme-compat',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: './playwright-theme-compat-report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: `node e2e/serve.mjs dist/theme-compat-e2e/${configuration}/browser 4399`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    cwd: process.cwd(),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
