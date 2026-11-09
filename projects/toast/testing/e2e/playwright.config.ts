import { defineConfig, devices } from '@playwright/test';

function executableOverride(variable: string) {
  const executablePath = process.env[variable];
  return executablePath ? { launchOptions: { executablePath } } : {};
}

const build = process.env['TOAST_E2E_BUILD'] ?? 'standalone';

export default defineConfig({
  testDir: '.',
  testMatch: 'theme-contract.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4399',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node e2e/serve.mjs dist/toast-compat-e2e/' + build + '/browser 4399',
    url: 'http://127.0.0.1:4399',
    reuseExistingServer: false,
    timeout: 120000,
    cwd: process.cwd(),
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...executableOverride('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'),
      },
    },
  ],
});
