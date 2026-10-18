import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import type { Plugin } from 'vite'

/** Where the worker is served from: the root, so that it can handle every screen of the app. */
export const WORKER_FILE = 'sw.js'

/**
 * The worker of a build, as JavaScript. `files` are the paths of the build to keep ("/assets/…");
 * the build identity comes from their names, which already change with their content, so a build
 * with other files is another worker and a build with the same files is the same one.
 */
export function buildWorker(files: readonly string[]): string {
  const sorted = [...files].sort()
  const build = createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 12)
  const source = readFileSync(new URL('worker.ts', import.meta.url), 'utf8')
  const header = `const BUILD = ${JSON.stringify(build)};\nconst FILES = ${JSON.stringify(sorted)};\n`
  return `${header}${stripTypeScriptTypes(source)}`
}

/** Writes `sw.js` next to the files of the app when the app is built. */
export function serviceWorker(): Plugin {
  return {
    name: 'ultra-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Only the app has a page, the Worker of Cloudflare is built as well and has no use for this.
      const files = Object.keys(bundle)
        // The fonts come as woff2 and, for browsers from long ago, as woff: nobody needs both.
        .filter((name) => name.startsWith('assets/') && !name.endsWith('.woff'))
        .map((name) => `/${name}`)
      if (files.length === 0) return
      this.emitFile({ type: 'asset', fileName: WORKER_FILE, source: buildWorker(files) })
    },
  }
}
