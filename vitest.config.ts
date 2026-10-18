import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The Worker imports Cloudflare's module, which only exists in their runtime.
    alias: {
      'cloudflare:workers': new URL('./server/testing/cloudflare-workers-stub.ts', import.meta.url)
        .pathname,
    },
  },
  test: {
    // The server and shared folders fill up in later issues.
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['{server,shared,scripts}/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
          // Vitest imports CSS as an empty string; the tokens and the styles of the board and the looks are read as text, to check them.
          css: { include: [/(tokens|Game|look-\w+)\.css/] },
        },
      },
    ],
  },
})
