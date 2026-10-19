import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import shared from './look-shared.css?raw'

const wallpaper = readFileSync('src/appearance/Wallpaper.css', 'utf8')

/** The declarations of the first rule that has exactly this selector. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`\n${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('the top and the bottom of the screen on an iPhone (issue #77)', () => {
  it('lies the wallpaper in the page and not in a fixed layer, which iOS gives a bar of its own behind the status bar', () => {
    const rules = `\n${wallpaper}`
    expect(rule(rules, '.wallpaper')).toContain('position: absolute')
    expect(rule(rules, '.wallpaper')).not.toMatch(/position:\s*fixed/)
    expect(rule(shared, 'body')).toContain('position: relative')
  })

  it('has no fixed element of the page left at the top of the screen', () => {
    expect(shared).not.toMatch(/position:\s*fixed/)
  })

  it('starts the page under the status bar and a margin, not at the larger of the two', () => {
    expect(rule(shared, '.app')).toContain('padding: calc(1rem + env(safe-area-inset-top))')
  })

  it('leaves room under the footer, on top of the home bar', () => {
    expect(rule(shared, '.app')).toContain('calc(2.5rem + env(safe-area-inset-bottom))')
  })
})
