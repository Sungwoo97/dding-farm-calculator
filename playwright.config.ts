import { defineConfig } from '@playwright/test'

export default defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:3000',
  },
  webServer: {
    command: 'npm run dev',
    env: {
      NEXT_PUBLIC_USE_FIXTURES: '1',
    },
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
})
