import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PAGE_PATHS, SHARE_IMAGE, isPage, withAbsoluteImage } from '../server/page.ts'

const root = new URL('../', import.meta.url)
const page = readFileSync(new URL('index.html', root), 'utf8')

describe('the pages of the app', () => {
  it('are the addresses of the router (src/online/route.ts), and nothing else', () => {
    for (const path of ['/', '/samen', '/spellen', '/statistieken', '/spel/abc', '/kamer/BCDF']) {
      expect(isPage(path)).toBe(true)
    }
    for (const path of ['/assets/index.js', '/og-image.png', '/sw.js', '/manifest.webmanifest']) {
      expect(isPage(path)).toBe(false)
    }
  })

  it('are the ones wrangler.jsonc wakes the Worker for, after /api/*', () => {
    const text = readFileSync(new URL('wrangler.jsonc', root), 'utf8')
    const config = text.replace(/^\s*\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
    const { assets } = JSON.parse(config) as {
      assets: { binding: string; run_worker_first: string[] }
    }
    expect(assets.binding).toBe('ASSETS')
    expect(assets.run_worker_first).toEqual(['/api/*', ...PAGE_PATHS])
  })
})

describe('the picture of a link', () => {
  it('is named in index.html with its own address, and the title and description around it', () => {
    expect(page).toContain(`<meta property="og:image" content="${SHARE_IMAGE}" />`)
    expect(page).toContain(`<meta name="twitter:image" content="${SHARE_IMAGE}" />`)
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(page).toContain('<meta property="og:title" content="Boter, Kaas en Eieren Ultra" />')
  })

  it('gets the whole address in front of it, wherever the page is served', () => {
    for (const origin of [
      'https://tic-tac-toe-ultra.example.workers.dev',
      'https://spel.example',
    ]) {
      const html = withAbsoluteImage(page, origin)
      expect(html).toContain(`<meta property="og:image" content="${origin}/og-image.png" />`)
      expect(html).toContain(`<meta name="twitter:image" content="${origin}/og-image.png" />`)
      expect(html).not.toContain('content="/og-image.png"')
    }
  })
})
