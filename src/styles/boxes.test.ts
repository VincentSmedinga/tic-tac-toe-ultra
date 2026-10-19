import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every CSS file of a part of the game, not the three looks, which only paint. */
function partsCss(dir = 'src'): string {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) return entry.name === 'styles' ? [] : [partsCss(path)]
      return entry.name.endsWith('.css') ? [readFileSync(path, 'utf8')] : []
    })
    .join('\n')
}

describe('the boxes that the looks draw an edge around', () => {
  const css = partsCss()

  // The looks give these an edge (look-*.css); a look that draws no edge, or a thin one, must not
  // leave what is inside sitting against it, so the padding is the part's, not the look's.
  it.each(['choice', 'game-item', 'message', 'share', 'lost'])(
    'keeps what is in .%s away from its edge, in every look',
    (name) => {
      expect(css).toMatch(new RegExp(`\\n\\.${name} \\{[^}]*padding`))
    },
  )
})
