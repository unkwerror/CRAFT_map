import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const localBaseUrl = 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  reporter: [['list']],
  timeout: 35_000,
  expect: { timeout: 12_000 },
  webServer: externalBaseUrl ? undefined : {
    command: 'npm run dev',
    url: localBaseUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    // Production проверяется только при явно заданном PLAYWRIGHT_BASE_URL.
    baseURL: externalBaseUrl ?? localBaseUrl,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
})
