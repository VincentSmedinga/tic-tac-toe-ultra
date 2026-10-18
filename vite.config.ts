import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The plugin runs the Worker of wrangler.jsonc next to the app: in `pnpm dev` and `pnpm preview`
// in the same runtime as Cloudflare's, and `pnpm build` builds both.
export default defineConfig({
  plugins: [react(), cloudflare()],
})
