import { describe, expect, it } from 'vitest'
import { contrast, themes } from './tokens.ts'

describe('the interface colours', () => {
  it.each(['light', 'dark'] as const)(
    'stand out from the page in the %s theme (3:1, the WCAG minimum for borders, highlights and focus)',
    (theme) => {
      const page = themes[theme]['--page'] ?? ''
      for (const name of ['--line', '--win', '--focus']) {
        expect(
          contrast(themes[theme][name] ?? '', page),
          `${name} on ${theme}`,
        ).toBeGreaterThanOrEqual(3)
      }
    },
  )

  it.each(['light', 'dark'] as const)('keep the text readable in the %s theme (4.5:1)', (theme) => {
    expect(
      contrast(themes[theme]['--text'] ?? '', themes[theme]['--page'] ?? ''),
    ).toBeGreaterThanOrEqual(4.5)
  })
})
