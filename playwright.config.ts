import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests against the production build, served the way Cloudflare does (the Worker with
 * the real Durable Object, in workerd): two browsers play a game together. `pnpm test:e2e` builds
 * first. One project, a phone in Chromium: the game is the same on every device, and each extra
 * browser costs minutes in CI.
 */
const PORT = 4180

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT.toString()}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'phone', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `pnpm exec vite preview --port ${PORT.toString()} --strictPort`,
    url: `http://localhost:${PORT.toString()}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
