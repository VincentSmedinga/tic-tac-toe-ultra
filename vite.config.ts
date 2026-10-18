import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { serviceWorker } from './service-worker/build.ts'

// The plugin runs the Worker of wrangler.jsonc next to the app: in `pnpm dev` and `pnpm preview`
// in the same runtime as Cloudflare's, and `pnpm build` builds both. The service worker is written
// next to the app's files by the build (service-worker/), and not in `pnpm dev`.
export default defineConfig({
  plugins: [react(), cloudflare(), serviceWorker()],
})
