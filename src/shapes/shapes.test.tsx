import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SHAPE_IDS } from '../../shared/shapes.ts'
import { contrast, themes } from '../styles/tokens.ts'
import { ShapeGallery } from './ShapeGallery.tsx'
import { ShapeIcon } from './ShapeIcon.tsx'
import { PATHS, SHAPES } from './shapes.ts'

describe('the set of shapes', () => {
  it('has the twelve shapes of the drawn sets, each once', () => {
    expect(SHAPES.map(({ id }) => id)).toEqual([
      'cross',
      'circle',
      'square',
      'diamond',
      'star',
      'plus',
      'asterisk',
      'oval',
      'heart',
      'fort',
      'waves',
      'goldbar',
    ])
    expect(new Set(SHAPES.map(({ name }) => name)).size).toBe(12)
  })

  it('has the same ids as the room knows, in the same order', () => {
    expect(SHAPES.map(({ id }) => id)).toEqual([...SHAPE_IDS])
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

  it('can be left out for screen readers when the text next to it says what it is', () => {
    const { container } = render(<ShapeIcon shape="cross" decorative />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has the size it is given', () => {
    render(<ShapeIcon shape="star" size={20} />)
    const icon = screen.getByRole('img', { name: 'ster' })
    expect(icon).toHaveAttribute('width', '20')
    expect(icon).toHaveAttribute('height', '20')
  })
})

describe('ShapeGallery', () => {
  it('shows all twelve next to each other, and every pair that can play against each other', () => {
    const { container } = render(<ShapeGallery />)
    expect(container.querySelectorAll('.shape-strip svg')).toHaveLength(12)
    // 12 shapes make 66 pairs of two.
    expect(container.querySelectorAll('.shape-pair')).toHaveLength(66)
  })

  it('shows every shape large and small, with its name and marker', () => {
    render(<ShapeGallery />)
    expect(screen.getAllByRole('img')).toHaveLength(SHAPES.length * 3)
    for (const { name, marker } of SHAPES) {
      expect(screen.getAllByRole('img', { name })).toHaveLength(3)
      expect(screen.getByText(marker)).toBeVisible()
    }
  })
})
