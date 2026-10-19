import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import shared from './look-shared.css?raw'

const playMode = readFileSync('src/play/PlayMode.css', 'utf8')

/** The declarations of the first rule that has exactly this selector. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`\n${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('the top of the screen on an iPhone (issue #77)', () => {
  it('covers the status bar with the backdrop of the page and the wallpaper, above the play mode', () => {
    const cover = rule(shared, '.status-bar-cover')
    expect(cover).toContain('position: fixed')
    expect(cover).toContain('height: env(safe-area-inset-top)')
    expect(cover).toContain('var(--backdrop, var(--chrome))')
    expect(cover).toContain('clip-path: inset(0)')
    expect(cover).toContain('pointer-events: none')
    const layer = /z-index: (\d+)/.exec(rule(playMode, '.game[data-play-mode]'))
    const above = /z-index: (\d+)/.exec(cover)
    expect(Number(above?.[1])).toBeGreaterThan(Number(layer?.[1]))
  })

  it('starts the page under the status bar and a margin, not at the larger of the two', () => {
    expect(rule(shared, '.app')).toContain('padding: calc(1rem + env(safe-area-inset-top))')
  })

  it('leaves room under the footer, on top of the home bar', () => {
    expect(rule(shared, '.app')).toContain('calc(2.5rem + env(safe-area-inset-bottom))')
  })
})
