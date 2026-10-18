import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import tokens from '../styles/tokens.css?raw'
import { ShapeGallery } from './ShapeGallery.tsx'
import { ShapeIcon } from './ShapeIcon.tsx'
import { PATHS, SHAPES } from './shapes.ts'

/** The `--name: #hex` tokens of one theme. */
function hexTokens(css: string): Record<string, string> {
  return Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map(
      ([, name = '', hex = '']): [string, string] => [name, hex],
    ),
  )
}

const [lightCss = '', darkCss = ''] = tokens.split('@media')
const themes = { light: hexTokens(lightCss), dark: hexTokens(darkCss) }

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

describe('the set of shapes', () => {
  it('has the seven shapes of the drawn set, each once', () => {
    expect(SHAPES.map(({ id }) => id)).toEqual([
      'cross',
      'circle',
      'square',
      'diamond',
      'star',
      'plus',
      'asterisk',
    ])
    expect(new Set(SHAPES.map(({ name }) => name)).size).toBe(7)
  })

  it('has a drawing for every shape', () => {
    expect(Object.keys(PATHS).sort()).toEqual(SHAPES.map(({ id }) => id).sort())
    for (const paths of Object.values(PATHS)) expect(paths.length).toBeGreaterThan(0)
  })
})

describe('the shape colours', () => {
  it.each(['light', 'dark'] as const)('are all defined in the %s theme', (theme) => {
    for (const { id } of SHAPES) expect(themes[theme][`--shape-${id}`]).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it.each(['light', 'dark'] as const)(
    'stand out from the page in the %s theme (3:1, the WCAG minimum for graphics)',
    (theme) => {
      const page = themes[theme]['--page'] ?? ''
      for (const { id } of SHAPES) {
        const colour = themes[theme][`--shape-${id}`] ?? ''
        expect(contrast(colour, page), `${id} on ${theme}`).toBeGreaterThanOrEqual(3)
      }
    },
  )
})

describe('ShapeIcon', () => {
  it.each(SHAPES)('draws the $name with its own colour and name', ({ id, name }) => {
    render(<ShapeIcon shape={id} />)
    const icon = screen.getByRole('img', { name })
    expect(icon).toHaveStyle({ stroke: `var(--shape-${id})` })
    expect(icon.querySelectorAll('path')).toHaveLength(PATHS[id].length)
  })

  it('has the size it is given', () => {
    render(<ShapeIcon shape="star" size={20} />)
    const icon = screen.getByRole('img', { name: 'ster' })
    expect(icon).toHaveAttribute('width', '20')
    expect(icon).toHaveAttribute('height', '20')
  })
})

describe('ShapeGallery', () => {
  it('shows every shape large and small, with its name and marker', () => {
    render(<ShapeGallery />)
    expect(screen.getAllByRole('img')).toHaveLength(SHAPES.length * 3)
    for (const { name, marker } of SHAPES) {
      expect(screen.getAllByRole('img', { name })).toHaveLength(3)
      expect(screen.getByText(marker)).toBeVisible()
    }
  })
})
