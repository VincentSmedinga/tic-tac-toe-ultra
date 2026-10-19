import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import boardCss from './Game.css?raw'

// Read from the disk: the test setup only keeps the CSS of some files, and this one is not among them.
const modeCss = readFileSync('src/play/PlayMode.css', 'utf8')

describe('what the field and the play mode are painted with', () => {
  it('paints the theme itself in the layer, because the real full screen shows nothing of the page behind it', () => {
    // The browser puts black behind a full screen element: a layer without the backdrop of the
    // look (and a wallpaper of its own) is a black screen in every theme.
    expect(modeCss).toMatch(/\.game\[data-play-mode\] \{[^}]*var\(--backdrop/)
  })

  it('draws the field on a see-through surface with what is behind it blurred, and not on a black slab', () => {
    expect(boardCss).toMatch(/--board-surface: color-mix\(.*transparent\)/)
    expect(boardCss).toMatch(/\.board::before \{[^}]*backdrop-filter: blur/)
  })
})
