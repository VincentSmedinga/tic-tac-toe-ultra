import { describe, expect, it } from 'vitest'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { distance, hexToOklch, maxChroma, simulate } from './color.ts'
import { themes } from './tokens.ts'

/**
 * Telling thirty-six shapes apart by colour. Distances are in OKLab times 100: about 2 is just
 * visible and 10 is clearly two colours. The minimums were set from the best palettes found, a
 * little below them, so that a later change can't make two shapes look more alike than they do now.
 * The first twelve shapes (the drawn ones) were found first and keep the wider distances between
 * them (the smallest is 10.4 in the light theme and 8.5 in the dark theme); the twenty-four after
 * them were fitted in between, so every pair with one of those is a little closer (6.9 and 7.0).
 */
const MIN_DISTANCE = { light: 9, dark: 8 } as const
const MIN_DISTANCE_WITH_NEW = { light: 6.5, dark: 6.5 } as const
/** The same under red-green colour blindness, where distances shrink: the shapes themselves differ too. */
const MIN_DISTANCE_COLOUR_BLIND = 4
const MIN_DISTANCE_COLOUR_BLIND_WITH_NEW = 2.7
/** How much of the colour a screen can show at that lightness and hue a colour has: not dull. */
const MIN_COLOURFULNESS = 0.8
/** The new shapes vary in intensity too, from a little muted to as vivid as the first twelve. */
const MIN_COLOURFULNESS_NEW = 0.55
/**
 * The lightness (OKLab L) every colour stays in, so that no shape looks much heavier or fainter
 * than another on the board: it is the band that has 3:1 against the page, in each theme.
 */
const LIGHTNESS_BAND = { light: [0.38, 0.66], dark: [0.59, 0.9] } as const
/** The star is grey on purpose, like its marker. */
const MAX_GREY_CHROMA = 0.02

/**
 * The hue family of each marker as drawn, as a window of OKLCH degrees: a colour may move inside
 * its window to get away from the others, but a cross stays red and a circle blue. Hues were read
 * from the photos (shapes.png, shapes-2.png): red about 25°, royal blue 245°, grass green 145°,
 * ultramarine purple 305°, pink 355°, ice blue 215°, viridian 165°, wine red 10°, prussian blue
 * 275°, orange 55°, lemon yellow 95°. The twenty-four shapes after them have no marker: their window
 * is the hue they were found at in both themes, 8° to either side, so that a later change can't
 * turn a green one into a pink one.
 */
const HUE_WINDOWS: Record<Exclude<ShapeId, 'star'>, readonly [number, number]> = {
  cross: [18, 32],
  circle: [236, 262],
  square: [136, 160],
  diamond: [290, 318],
  plus: [335, 360],
  asterisk: [196, 222],
  oval: [160, 188],
  heart: [-8, 16],
  fort: [262, 286],
  waves: [48, 68],
  goldbar: [78, 98],
  middle: [1, 32],
  person: [-2, 29],
  triangle: [19, 51],
  bowtie: [13, 43],
  ankh: [42, 64],
  bolt: [59, 83],
  pi: [82, 113],
  ogham: [121, 152],
  sigma: [109, 140],
  bowl: [145, 176],
  eye: [151, 182],
  anchor: [200, 225],
  drop: [226, 257],
  hangul: [232, 263],
  omega: [250, 281],
  moon: [277, 308],
  aleph: [272, 296],
  psi: [286, 317],
  infinity: [301, 317],
  pa: [307, 330],
  braille: [331, 355],
  ya: [327, 350],
  thorn: [337, 361],
  curl: [337, 353],
}

const THEMES = ['light', 'dark'] as const

const colourOf = (theme: (typeof THEMES)[number], id: ShapeId) =>
  themes[theme][`--shape-${id}`] ?? ''

/** The shapes that were drawn by hand, with a marker: the first twelve. */
const isDrawn = (id: ShapeId) =>
  SHAPES.some((shape) => shape.id === id && shape.marker !== undefined)

/**
 * Every pair of shapes with how far apart their colours are, smallest first, and whether both were
 * drawn by hand (those are held to the wider distances).
 */
function pairs(theme: (typeof THEMES)[number], kind?: 'protanopia' | 'deuteranopia') {
  const result: { names: string; distance: number; drawn: boolean }[] = []
  for (const [i, first] of SHAPES.entries()) {
    for (const second of SHAPES.slice(i + 1)) {
      let a = colourOf(theme, first.id)
      let b = colourOf(theme, second.id)
      if (kind) {
        a = simulate(a, kind)
        b = simulate(b, kind)
      }
      result.push({
        names: `${first.id} and ${second.id}`,
        distance: distance(a, b),
        drawn: isDrawn(first.id) && isDrawn(second.id),
      })
    }
  }
  return result.sort((x, y) => x.distance - y.distance)
}

describe('the colours of the shapes', () => {
  it.each(THEMES)('are clearly apart from each other in the %s theme', (theme) => {
    for (const { names, distance: apart, drawn } of pairs(theme)) {
      const minimum = drawn ? MIN_DISTANCE[theme] : MIN_DISTANCE_WITH_NEW[theme]
      expect(apart, `${names} in the ${theme} theme`).toBeGreaterThanOrEqual(minimum)
    }
  })

  it.each(THEMES)(
    'stay apart for people with red-green colour blindness in the %s theme',
    (theme) => {
      for (const kind of ['protanopia', 'deuteranopia'] as const) {
        for (const { names, distance: apart, drawn } of pairs(theme, kind)) {
          expect(apart, `${names} as seen with ${kind}`).toBeGreaterThanOrEqual(
            drawn ? MIN_DISTANCE_COLOUR_BLIND : MIN_DISTANCE_COLOUR_BLIND_WITH_NEW,
          )
        }
      }
    },
  )

  it.each(THEMES)('are colourful in the %s theme, except for the grey star', (theme) => {
    for (const { id } of SHAPES) {
      const { L, C, h } = hexToOklch(colourOf(theme, id))
      if (id === 'star') expect(C, 'star').toBeLessThanOrEqual(MAX_GREY_CHROMA)
      else
        expect(C / maxChroma(L, h), `${id} in the ${theme} theme`).toBeGreaterThanOrEqual(
          isDrawn(id) ? MIN_COLOURFULNESS : MIN_COLOURFULNESS_NEW,
        )
    }
  })

  it.each(THEMES)('are all about as light as each other in the %s theme', (theme) => {
    const [low, high] = LIGHTNESS_BAND[theme]
    for (const { id } of SHAPES) {
      const { L } = hexToOklch(colourOf(theme, id))
      expect(L, `${id} in the ${theme} theme`).toBeGreaterThanOrEqual(low)
      expect(L, `${id} in the ${theme} theme`).toBeLessThanOrEqual(high)
    }
  })

  it('has a hue window for every shape but the grey star', () => {
    expect(Object.keys(HUE_WINDOWS).sort()).toEqual(
      SHAPES.map(({ id }) => id)
        .filter((id) => id !== 'star')
        .sort(),
    )
  })

  it.each(THEMES)('keep their hue (of the marker, for the drawn ones) in the %s theme', (theme) => {
    for (const [id, [low, high]] of Object.entries(HUE_WINDOWS)) {
      const { h } = hexToOklch(colourOf(theme, id as ShapeId))
      // Hues wrap round at 360, so count from the start of the window.
      const into = (((h - low) % 360) + 360) % 360
      const width = (((high - low) % 360) + 360) % 360
      expect(
        into,
        `${id} in the ${theme} theme has hue ${Math.round(h).toString()}°`,
      ).toBeLessThanOrEqual(width)
    }
  })
})
