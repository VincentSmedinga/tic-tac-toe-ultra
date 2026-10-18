/**
 * Colour arithmetic for the tests of the palette: contrast as WCAG measures it, and how far apart
 * two colours look, measured in OKLab (a space in which equal distances look about equally big),
 * also as people with red-green colour blindness see them. No browser APIs, so it runs in Node.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface Oklab {
  L: number
  a: number
  b: number
}

/** A colour as lightness (0 to 1), chroma (how colourful: 0 is grey) and hue (degrees). */
export interface Oklch {
  L: number
  C: number
  h: number
}

/** `#rrggbb` as linear light, each channel from 0 to 1 (the sRGB curve taken out). */
export function hexToLinear(hex: string): Rgb {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return { r: channel(1), g: channel(3), b: channel(5) }
}

/** Linear light back to `#rrggbb`; null when a channel is outside what a screen can show. */
export function linearToHex({ r, g, b }: Rgb): string | null {
  const encode = (value: number) => {
    if (value < -0.0005 || value > 1.0005) return null
    const clamped = Math.min(1, Math.max(0, value))
    const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, '0')
  }
  const parts = [encode(r), encode(g), encode(b)]
  return parts.includes(null) ? null : `#${parts.join('')}`
}

export function linearToOklab({ r, g, b }: Rgb): Oklab {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

export function oklabToLinear({ L, a, b }: Oklab): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  }
}

export function hexToOklab(hex: string): Oklab {
  return linearToOklab(hexToLinear(hex))
}

export function hexToOklch(hex: string): Oklch {
  const { L, a, b } = hexToOklab(hex)
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

/** `#rrggbb` for a colour given as lightness, chroma and hue; null when a screen can't show it. */
export function oklchToHex({ L, C, h }: Oklch): string | null {
  const radians = (h * Math.PI) / 180
  return linearToHex(oklabToLinear({ L, a: C * Math.cos(radians), b: C * Math.sin(radians) }))
}

/** The most chroma a screen can show at this lightness and hue (the edge of the sRGB colours). */
export function maxChroma(L: number, h: number): number {
  let low = 0
  let high = 0.5
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (oklchToHex({ L, C: middle, h }) === null) high = middle
    else low = middle
  }
  return low
}

/** The distance between two colours in OKLab, times 100: about 2 is just visible, 10 is clear. */
export function distance(a: string, b: string): number {
  const first = hexToOklab(a)
  const second = hexToOklab(b)
  return 100 * Math.hypot(first.L - second.L, first.a - second.a, first.b - second.b)
}

export type ColourBlindness = 'protanopia' | 'deuteranopia'

/** Machado, Oliveira and Fernandes (2009), full severity, applied to linear light. */
const MATRICES: Record<ColourBlindness, readonly (readonly [number, number, number])[]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
}

/** The colour as someone with red-green colour blindness sees it, as `#rrggbb`. */
export function simulate(hex: string, kind: ColourBlindness): string {
  const { r, g, b } = hexToLinear(hex)
  const [row1, row2, row3] = MATRICES[kind]
  const mix = (row: readonly [number, number, number] | undefined) =>
    (row?.[0] ?? 0) * r + (row?.[1] ?? 0) * g + (row?.[2] ?? 0) * b
  // Out of range by a hair is clamped: the matrices are made for colours inside the screen's range.
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  return linearToHex({ r: clamp(mix(row1)), g: clamp(mix(row2)), b: clamp(mix(row3)) }) ?? '#000000'
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToLinear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}
