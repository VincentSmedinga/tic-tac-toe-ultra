import { describe, expect, it } from 'vitest'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { distance, hexToOklch, maxChroma, simulate } from './color.ts'
import { themes } from './tokens.ts'

/**
 * Telling twelve shapes apart by colour. Distances are in OKLab times 100: about 2 is just visible
 * and 10 is clearly two colours. The minimums were set from the best palette found (the smallest
 * distance in the light theme is 10.4, in the dark theme 8.5), a little below it, so that a later
 * change can't make two shapes look more alike than they do now.
 */
const MIN_DISTANCE = { light: 9, dark: 8 } as const
/** The same under red-green colour blindness, where distances shrink: the shapes themselves differ too. */
const MIN_DISTANCE_COLOUR_BLIND = 4
/** How much of the colour a screen can show at that lightness and hue a colour has: not dull. */
const MIN_COLOURFULNESS = 0.8
/** The star is grey on purpose, like its marker. */
const MAX_GREY_CHROMA = 0.02

/**
 * The hue family of each marker as drawn, as a window of OKLCH degrees: a colour may move inside
 * its window to get away from the others, but a cross stays red and a circle blue. Hues were read
 * from the photos (shapes.png, shapes-2.png): red about 25°, royal blue 245°, grass green 145°,
 * ultramarine purple 305°, pink 355°, ice blue 215°, viridian 165°, wine red 10°, prussian blue
 * 275°, orange 55°, lemon yellow 95°.
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
}

const THEMES = ['light', 'dark'] as const

const colourOf = (theme: (typeof THEMES)[number], id: ShapeId) =>
  themes[theme][`--shape-${id}`] ?? ''

/** Every pair of shapes with how far apart their colours are, smallest first. */
function pairs(theme: (typeof THEMES)[number], kind?: 'protanopia' | 'deuteranopia') {
  const result: { names: string; distance: number }[] = []
  for (const [i, first] of SHAPES.entries()) {
    for (const second of SHAPES.slice(i + 1)) {
      let a = colourOf(theme, first.id)
      let b = colourOf(theme, second.id)
      if (kind) {
        a = simulate(a, kind)
        b = simulate(b, kind)
      }
      result.push({ names: `${first.id} and ${second.id}`, distance: distance(a, b) })
    }
  }
  return result.sort((x, y) => x.distance - y.distance)
}

describe('the colours of the twelve shapes', () => {
  it.each(THEMES)('are clearly apart from each other in the %s theme', (theme) => {
    for (const { names, distance: apart } of pairs(theme)) {
      expect(apart, `${names} in the ${theme} theme`).toBeGreaterThanOrEqual(MIN_DISTANCE[theme])
    }
  })

  it.each(THEMES)(
    'stay apart for people with red-green colour blindness in the %s theme',
    (theme) => {
      for (const kind of ['protanopia', 'deuteranopia'] as const) {
        for (const { names, distance: apart } of pairs(theme, kind)) {
          expect(apart, `${names} as seen with ${kind}`).toBeGreaterThanOrEqual(
            MIN_DISTANCE_COLOUR_BLIND,
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
          MIN_COLOURFULNESS,
        )
    }
  })

  it.each(THEMES)('keep the hue of the marker they were drawn with in the %s theme', (theme) => {
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
