import tokens from './tokens.css?raw'

export { contrast } from './color.ts'

/** The `--name: #hex` tokens of one theme. */
function hexTokens(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(
      ([, name = '', hex = '']): [string, string] => [name, hex],
    ),
  )
}

const [lightCss = '', darkCss = ''] = tokens.split(":root[data-scheme='dark']")

/** The colour tokens of each scheme, read from tokens.css as text, for tests. */
export const themes = { light: hexTokens(lightCss), dark: hexTokens(darkCss) }
