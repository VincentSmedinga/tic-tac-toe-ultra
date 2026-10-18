import { describe, expect, it } from 'vitest'
import calm from './look-calm.css?raw'
import drawn from './look-drawn.css?raw'
import playful from './look-playful.css?raw'

/** The declarations of the first rule that has exactly this selector. */
function rule(css: string, selector: string) {
  const start = css.indexOf(`\n${selector} {`)
  return start < 0 ? '' : css.slice(start, css.indexOf('}', start))
}

describe('the lines of the board, in each look', () => {
  it('Getekend draws them by hand, in ink, a little heavier on a small field', () => {
    expect(rule(drawn, "html[data-look='drawn'] .board-line-straight")).toContain('display: none')
    expect(rule(drawn, "html[data-look='drawn'] .board-line-hand")).toContain('display: inline')
    const frame = rule(drawn, "html[data-look='drawn'] .board-frame")
    expect(frame).toContain('--line-color: var(--ink)')
    expect(frame).toMatch(/--line-width: clamp\(2px, [^,]+, 4px\)/)
  })

  it('Speels draws them thick and round, in the colour of the edge', () => {
    expect(rule(playful, "html[data-look='playful'] .board-frame")).toContain(
      '--line-color: var(--edge)',
    )
    expect(rule(playful, "html[data-look='playful'] .board-line path")).toContain(
      'stroke-linecap: round',
    )
    expect(rule(playful, "html[data-look='playful'] .board-frame")).toMatch(
      /--line-width: clamp\(3px/,
    )
  })

  it('Speels draws them in the line token in the dark scheme, where its edge is black like the page', () => {
    expect(rule(playful, "html[data-look='playful'][data-scheme='dark'] .board-frame")).toContain(
      '--line-color: var(--line)',
    )
  })

  it('Rustig draws them thin and straight, in the colour of the line token', () => {
    const frame = rule(calm, "html[data-look='calm'] .board-frame")
    expect(frame).toContain('--line-color: var(--line)')
    expect(frame).toContain('--line-width: 2px')
    expect(calm).not.toContain('.board-line-hand')
  })

  it('no look leaves a gap between cells or a border round one', () => {
    for (const css of [drawn, playful, calm]) {
      expect(css).not.toContain('--gap')
      expect(css).not.toMatch(/\.cell[^{]*\{[^}]*border:/)
    }
  })
})
