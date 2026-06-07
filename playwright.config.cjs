const { defineConfig, devices } = require('@playwright/test');

const port = Number.parseInt(process.env.NPSH_E2E_PORT || '4187', 10);
const baseURL = process.env.NPSH_E2E_BASE_URL || `http://127.0.0.1:${port}`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  outputDir: 'test-artifacts/playwright-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-artifacts/playwright-report', open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.NPSH_E2E_BASE_URL
    ? undefined
    : {
        command: `node tools/serve-local-api-preview.cjs --host 127.0.0.1 --port ${port}`,
        url: `${baseURL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
        stdout: 'pipe',
        stderr: 'pipe'
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 }
      }
    }
  ]
});
