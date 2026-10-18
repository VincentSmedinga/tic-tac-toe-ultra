import { Resvg } from '@resvg/resvg-js'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PATHS } from '../src/shapes/shapes.ts'
import { ICON_SHAPES, MASKABLE_SCALE, darkShapeColours, iconSvg, makeIcons } from './icons.ts'

const root = new URL('../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, root), 'utf8')
const tokens = read('src/styles/tokens.css')

/** The width and height written in the header of a PNG file. */
function pngSize(path: string) {
  const bytes = readFileSync(new URL(path, root))
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

interface Manifest {
  name: string
  short_name: string
  lang: string
  start_url: string
  scope: string
  display: string
  background_color: string
  theme_color: string
  icons: { src: string; sizes: string; type: string; purpose: string }[]
}
const manifest = JSON.parse(read('public/manifest.webmanifest')) as Manifest

describe('the icon', () => {
  it('is made from the paths of the shapes, in the colours of the dark scheme', () => {
    const svg = read('public/icon.svg')
    const colours = darkShapeColours(tokens)
    expect(ICON_SHAPES).toEqual(['cross', 'circle', 'fort', 'square'])
    for (const shape of ICON_SHAPES) {
      for (const d of PATHS[shape]) expect(svg).toContain(`d="${d}"`)
      expect(svg).toContain(`stroke="${colours[shape] ?? ''}"`)
    }
  })

  it('is the file that `pnpm icons` makes, so that a changed shape changes the icon', () => {
    const made = makeIcons(tokens)
    expect(read('public/icon.svg')).toBe(made.get('icon.svg'))
    expect(read('public/favicon.svg')).toBe(made.get('favicon.svg'))
  })

  it('has its pictures at the sizes in their names', () => {
    expect(pngSize('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
    expect(pngSize('public/icon-192.png')).toEqual({ width: 192, height: 192 })
    expect(pngSize('public/icon-512.png')).toEqual({ width: 512, height: 512 })
    expect(pngSize('public/icon-maskable-512.png')).toEqual({ width: 512, height: 512 })
    expect(pngSize('public/favicon-32.png')).toEqual({ width: 32, height: 32 })
  })

  it('has the dark background right to the edges, which iOS needs: it turns transparency black', () => {
    const render = new Resvg(read('public/icon.svg')).render()
    const { width, height, pixels } = render
    const at = (x: number, y: number) => [
      ...pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
    ]
    for (const [x, y] of [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ] as const) {
      expect(at(x, y)).toEqual([0x1b, 0x1b, 0x1f, 255])
    }
  })

  it('keeps everything of the maskable icon inside the safe zone: a circle of 80 % of the square', () => {
    const { width, height, pixels } = new Resvg(
      iconSvg(tokens, { scale: MASKABLE_SCALE, background: false }),
    ).render()
    const radius = (width * 0.8) / 2
    let drawn = 0
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((pixels[(y * width + x) * 4 + 3] ?? 0) === 0) continue
        drawn++
        const distance = Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2)
        expect(distance).toBeLessThanOrEqual(radius)
      }
    }
    expect(drawn).toBeGreaterThan(1000)
  })
})

describe('the manifest', () => {
  it('names the game, opens in its own window and starts at the front', () => {
    expect(manifest.name).toBe('Boter, Kaas en Eieren Ultra')
    expect(manifest.short_name).toBe('Ultra')
    expect(manifest.lang).toBe('nl')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.theme_color).toBe('#1b1b1f')
    expect(manifest.background_color).toBe('#1b1b1f')
  })

  it('has the icons it names in public/, at the sizes it says, and a maskable one', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3)
    for (const icon of manifest.icons) {
      expect(existsSync(new URL(`public${icon.src}`, root))).toBe(true)
      if (icon.type === 'image/png') {
        const [width, height] = icon.sizes.split('x').map(Number)
        expect(pngSize(`public${icon.src}`)).toEqual({ width, height })
      }
    }
    expect(manifest.icons.filter((icon) => icon.purpose === 'maskable')).toHaveLength(1)
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true)
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any')).toBe(
      true,
    )
  })

  it('is linked from the page, with the icons the browsers and the iPhone ask for', () => {
    const page = read('index.html')
    expect(page).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(page).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
    expect(page).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />')
    expect(page).toContain('viewport-fit=cover')
    expect(page).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />')
    expect(page).toContain('<meta name="apple-mobile-web-app-title" content="Ultra" />')
    expect(page).toContain('content="black-translucent"')
  })

  it('is served as a manifest, and the icons are kept for a day', () => {
    const headers = read('public/_headers')
    expect(headers).toMatch(/\/manifest\.webmanifest\n\s+Content-Type: application\/manifest\+json/)
    expect(headers).toMatch(/\/\*\.png\n\s+Cache-Control: public, max-age=86400/)
  })
})
