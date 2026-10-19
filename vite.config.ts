import { execSync } from 'node:child_process'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serviceWorker } from './service-worker/build.ts'

// The plugin runs the Worker of wrangler.jsonc next to the app: in `pnpm dev` and `pnpm preview`
// in the same runtime as Cloudflare's, and `pnpm build` builds both. The service worker is written
// next to the app's files by the build (service-worker/), and not in `pnpm dev`.
// The settings page says which build this is: the short commit, or "dev" where there is no git.
function version(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker()],
  define: { __APP_VERSION__: JSON.stringify(version()) },
})
