import { defineConfig, devices } from '@playwright/test';

function executableOverride(variable: string) {
  const executablePath = process.env[variable];
  return executablePath ? { launchOptions: { executablePath } } : {};
}

export default defineConfig({
  testDir: './e2e/table',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node e2e/serve.mjs dist/table-e2e/browser 4300',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...executableOverride('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'),
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...executableOverride('PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH'),
      },
    },
  ],
});
