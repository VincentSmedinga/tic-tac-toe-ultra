/**
 * The app icon and the files made from it: `node scripts/icons.ts` writes them into `public/`.
 *
 * The picture is the game's own drawing: four shapes (the paths of `PATHS` in
 * `src/shapes/shapes.ts`, in the colours of the dark scheme in `src/styles/tokens.css`) in the
 * four cells of a grid of marker lines (one down, one across: a 2 × 2 keeps the shapes big), on the
 * dark of the page, as the board is drawn. So a change to a shape, a colour or a line is a change
 * to the icon, with this one command; `icons.test.ts` fails when the files in `public/` no longer
 * match what this makes.
 *
 * - `icon.svg`: the picture, square and not rounded (a phone rounds it), the background right to
 *   the edges (iOS turns transparency black).
 * - `favicon.svg`: for a browser tab, where the lines would be thinner than a pixel: the four
 *   shapes bigger and bolder, without the lines, on a rounded square.
 * - `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `favicon-32.png`: the same,
 *   as pictures, for what doesn't take an SVG.
 * - `icon-maskable-512.png`: Android crops an icon to a circle or a squircle, so the whole picture
 *   is drawn smaller, inside a circle of 80 % of the square (the safe zone).
 * - `og-image.png` (1200 × 630): the face of a link in a chat (`og:image`): the icon on the left,
 *   the title in the font of the Getekend look on the right, on the dark of the page.
 */
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { PATHS } from '../src/shapes/shapes.ts'
import type { ShapeId } from '../src/shapes/shapes.ts'

const SIZE = 512
/** The dark of the page in the dark scheme (`--page`). */
const BACKGROUND = '#1b1b1f'
/** The lines, the light of the text in the dark scheme (`--text`): white, a little softened. */
const INK = '#f2f2f4'

/** The four shapes, row by row: left to right, top to bottom. */
export const ICON_SHAPES = [
  'cross',
  'circle',
  'fort',
  'square',
] as const satisfies readonly ShapeId[]

/** The colour of each shape in the dark scheme, read from tokens.css (the one that has the contrast on a dark page). */
export function darkShapeColours(tokens: string): Record<string, string> {
  const dark = tokens.split(":root[data-scheme='dark']")[1] ?? ''
  return Object.fromEntries(
    [...dark.matchAll(/--shape-([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name = '', hex = '']) => [
      name,
      hex,
    ]),
  )
}

/**
 * The lines between the four shapes, as a marker draws them: a little crooked, each its own. One
 * down and one across, and none around, as on the board.
 */
const LINES = ['M257 26 L254 150 L258 340 L255 486', 'M26 255 L170 252 L340 258 L486 254'] as const

const LINE_WIDTH = 11

/** Where the shapes of the 64 × 64 drawing go: the centres of the four cells. */
const CENTRES = [
  [128, 128],
  [384, 128],
  [128, 384],
  [384, 384],
] as const

interface PictureOptions {
  /** The colour of each shape, by id. */
  colours: Record<string, string>
  /** The size of a shape in the picture, in pixels of the 512 square. */
  shapeSize: number
  /** The width of a shape's line in the 64 × 64 drawing (the board uses 6.5). */
  strokeWidth: number
  /** Where the four shapes are centred. */
  centres: readonly (readonly [number, number])[]
  /** Draw the lines between the shapes. */
  lines: boolean
}

/** The shapes and the lines, with no background, as a group of the 512 square. */
function picture({ colours, shapeSize, strokeWidth, centres, lines }: PictureOptions): string {
  const scale = shapeSize / 64
  const shapes = ICON_SHAPES.map((shape, index) => {
    const [x = 0, y = 0] = centres[index] ?? []
    const paths = PATHS[shape].map((d) => `<path d="${d}"/>`).join('')
    return `<g transform="translate(${round(x - shapeSize / 2)} ${round(y - shapeSize / 2)}) scale(${round(scale)})" stroke="${colours[shape] ?? INK}" stroke-width="${strokeWidth.toString()}">${paths}</g>`
  }).join('')
  const board = lines
    ? `<g stroke="${INK}" stroke-width="${LINE_WIDTH.toString()}">${LINES.map((d) => `<path d="${d}"/>`).join('')}</g>`
    : ''
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${board}${shapes}</g>`
}

const round = (value: number) => Number(value.toFixed(3))

/**
 * What the icon draws, without the `<svg>` around it. `scale` draws the whole picture smaller
 * around the middle (for the maskable icon); `background` fills the square (left out to measure
 * what is drawn).
 */
function iconBody(tokens: string, { scale = 1, background = true } = {}): string {
  const colours = darkShapeColours(tokens)
  const content = picture({
    colours,
    shapeSize: 180,
    strokeWidth: 6.5,
    centres: CENTRES,
    lines: true,
  })
  const middle = SIZE / 2
  const inner =
    scale === 1
      ? content
      : `<g transform="translate(${middle.toString()} ${middle.toString()}) scale(${scale.toString()}) translate(${(-middle).toString()} ${(-middle).toString()})">${content}</g>`
  const fill = background
    ? `<rect width="${SIZE.toString()}" height="${SIZE.toString()}" fill="${BACKGROUND}"/>`
    : ''
  return `${fill}${inner}`
}

/** The icon as an SVG; see `iconBody` for the options. */
export function iconSvg(
  tokens: string,
  options: { scale?: number; background?: boolean } = {},
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.toString()} ${SIZE.toString()}">${iconBody(tokens, options)}</svg>\n`
}

/** The icon for a browser tab: bigger, bolder shapes without the lines, on a rounded square. */
export function faviconSvg(tokens: string): string {
  const content = picture({
    colours: darkShapeColours(tokens),
    shapeSize: 192,
    strokeWidth: 9,
    centres: [
      [136, 136],
      [376, 136],
      [136, 376],
      [376, 376],
    ],
    lines: false,
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.toString()} ${SIZE.toString()}"><rect width="${SIZE.toString()}" height="${SIZE.toString()}" rx="96" fill="${BACKGROUND}"/>${content}</svg>\n`
}

/** How much of the picture the maskable icon keeps: all of it fits the circle of the safe zone. */
export const MASKABLE_SCALE = 0.67

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
/** The font of the title in the Getekend look: Patrick Hand, which `@fontsource` ships as WOFF. */
export const OG_FONT = 'Patrick Hand'
/** The title in three lines, as it is set in the picture. */
export const OG_TITLE = ['Boter, Kaas', 'en Eieren', 'Ultra'] as const

/** The picture that goes with a link: the icon on the left, the title on the right, on the dark page. */
export function ogImageSvg(tokens: string): string {
  const width = OG_WIDTH.toString()
  const height = OG_HEIGHT.toString()
  const iconSize = 420
  const top = (OG_HEIGHT - iconSize) / 2
  const lineHeight = 132
  const firstBaseline = OG_HEIGHT / 2 - lineHeight + 38
  const lines = OG_TITLE.map(
    (line, index) =>
      `<text x="600" y="${(firstBaseline + index * lineHeight).toString()}">${line}</text>`,
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${BACKGROUND}"/><clipPath id="round"><rect x="90" y="${top.toString()}" width="${iconSize.toString()}" height="${iconSize.toString()}" rx="72"/></clipPath><g clip-path="url(#round)"><svg x="90" y="${top.toString()}" width="${iconSize.toString()}" height="${iconSize.toString()}" viewBox="0 0 ${SIZE.toString()} ${SIZE.toString()}">${iconBody(tokens)}</svg></g><g fill="${INK}" font-family="${OG_FONT}" font-size="122">${lines}</g></svg>\n`
}

/**
 * A WOFF file as the TrueType font inside it. WOFF is that font with each table compressed, and
 * resvg only reads TrueType, so the font the game ships can be used for the picture.
 */
export function ttfFromWoff(woff: Buffer): Buffer {
  const count = woff.readUInt16BE(12)
  const header = Buffer.alloc(12 + 16 * count)
  woff.copy(header, 0, 4, 8) // the flavor: what kind of outlines
  header.writeUInt16BE(count, 4)
  let power = 0
  while (2 ** (power + 1) <= count) power++
  header.writeUInt16BE(2 ** power * 16, 6)
  header.writeUInt16BE(power, 8)
  header.writeUInt16BE(count * 16 - 2 ** power * 16, 10)

  const tables: Buffer[] = []
  let offset = header.length
  for (let index = 0; index < count; index++) {
    const entry = 44 + index * 20
    const start = woff.readUInt32BE(entry + 4)
    const compressed = woff.readUInt32BE(entry + 8)
    const length = woff.readUInt32BE(entry + 12)
    const stored = woff.subarray(start, start + compressed)
    const data = compressed < length ? inflateSync(stored) : stored
    const target = 12 + index * 16
    woff.copy(header, target, entry, entry + 4) // the tag
    header.writeUInt32BE(woff.readUInt32BE(entry + 16), target + 4) // the checksum
    header.writeUInt32BE(offset, target + 8)
    header.writeUInt32BE(length, target + 12)
    const padded = Buffer.alloc((length + 3) & ~3) // every table starts on a multiple of 4
    data.copy(padded)
    tables.push(padded)
    offset += padded.length
  }
  return Buffer.concat([header, ...tables])
}

/** The picture of the link as a PNG, with the title in the font file at `fontPath` (a TrueType file). */
export function ogImagePng(tokens: string, fontPath: string): Buffer {
  return new Resvg(ogImageSvg(tokens), {
    font: { fontFiles: [fontPath], loadSystemFonts: false },
  })
    .render()
    .asPng()
}

/** The pictures of the icon, by file name, as the bytes to write. */
export function makeIcons(tokens: string): Map<string, string | Buffer> {
  const full = iconSvg(tokens)
  const favicon = faviconSvg(tokens)
  const png = (svg: string, width: number) =>
    new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
  return new Map<string, string | Buffer>([
    ['icon.svg', full],
    ['favicon.svg', favicon],
    ['apple-touch-icon.png', png(full, 180)],
    ['icon-192.png', png(full, 192)],
    ['icon-512.png', png(full, 512)],
    ['icon-maskable-512.png', png(iconSvg(tokens, { scale: MASKABLE_SCALE }), 512)],
    ['favicon-32.png', png(favicon, 32)],
  ])
}

/** Where the font of the title is (`pnpm install` puts it there). */
const FONT_WOFF = new URL(
  '../node_modules/@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff',
  import.meta.url,
)

/** `ogImagePng` with the game's own font: it is turned into a TrueType file in a folder of its own first. */
export function makeOgImage(tokens: string): Buffer {
  const folder = mkdtempSync(join(tmpdir(), 'ultra-og-'))
  const fontPath = join(folder, 'patrick-hand.ttf')
  try {
    writeFileSync(fontPath, ttfFromWoff(readFileSync(FONT_WOFF)))
    return ogImagePng(tokens, fontPath)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  const root = new URL('..', import.meta.url)
  const tokens = readFileSync(new URL('src/styles/tokens.css', root), 'utf8')
  const publicDir = new URL('public/', root)
  mkdirSync(publicDir, { recursive: true })
  const files = makeIcons(tokens)
  files.set('og-image.png', makeOgImage(tokens))
  for (const [name, bytes] of files) {
    writeFileSync(new URL(name, publicDir), bytes)
    console.log(`public/${name}`)
  }
}
