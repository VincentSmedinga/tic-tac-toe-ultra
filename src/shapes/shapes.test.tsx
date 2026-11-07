import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { arrivalPlan } from '../motion/arrival.ts'
import { SHAPE_IDS } from '../../shared/shapes.ts'
import { contrast, themes } from '../styles/tokens.ts'
import { LANGUAGES } from '../i18n/language.ts'
import { isRing } from './closure.ts'
import { strokeLengths } from './length.ts'
import { ShapeIcon } from './ShapeIcon.tsx'
import { shapeNamesFor } from './names.ts'
import { PATHS, SHAPES } from './shapes.ts'

describe('the set of shapes', () => {
  it('has the twelve shapes of the drawn sets first, each once', () => {
    expect(SHAPES.slice(0, 12).map(({ id }) => id)).toEqual([
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
    expect(SHAPES.slice(0, 12).every(({ marker }) => marker !== undefined)).toBe(true)
  })

  it('has twenty-four more after them, each with what it comes from', () => {
    expect(SHAPES).toHaveLength(36)
    expect(new Set(SHAPES.map(({ id }) => id)).size).toBe(36)
    for (const shape of SHAPES.slice(12)) {
      expect(shape.origin, shape.id).toBeTruthy()
      expect(shape.marker, shape.id).toBeUndefined()
    }
  })

  it('has a name in every language, and no two shapes with the same name', () => {
    for (const { id } of LANGUAGES) {
      const { name } = shapeNamesFor(id)
      expect(new Set(SHAPES.map((shape) => name(shape.id))).size).toBe(36)
    }
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
  it.each(SHAPES)('draws the $id with its own colour and name', ({ id }) => {
    const name = shapeNamesFor('nl').name(id)
    render(<ShapeIcon shape={id} />)
    const icon = screen.getByRole('img', { name })
    expect(icon).toHaveStyle({ stroke: `var(--shape-${id})` })
    expect(icon.querySelectorAll('path')).toHaveLength(PATHS[id].length)
  })

  describe('when it arrives', () => {
    afterEach(() => {
      Reflect.deleteProperty(Element.prototype, 'animate')
    })

    it.each(SHAPES)('writes every stroke of the $id, one animation each', ({ id }) => {
      const animate = vi.fn(() => ({ cancel: vi.fn() }) as unknown as Animation)
      Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true })
      const plan = arrivalPlan(5, 1, strokeLengths(id), isRing(id))
      render(<ShapeIcon shape={id} arrival={{ plan, mode: 'full' }} />)
      expect(animate).toHaveBeenCalledTimes(PATHS[id].length)
      expect(plan.strokes).toHaveLength(PATHS[id].length)
    })
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
