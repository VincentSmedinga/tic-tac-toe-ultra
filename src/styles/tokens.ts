import tokens from './tokens.css?raw'

/** The `--name: #hex` tokens of one theme. */
function hexTokens(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(
      ([, name = '', hex = '']): [string, string] => [name, hex],
    ),
  )
}

const [lightCss = '', darkCss = ''] = tokens.split('@media')

/** The colour tokens of each theme, read from tokens.css as text, for tests. */
export const themes = { light: hexTokens(lightCss), dark: hexTokens(darkCss) }

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two #rrggbb colours, from 1 to 21. */
export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}
