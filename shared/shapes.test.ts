import { describe, expect, it } from 'vitest'
import { SHAPE_IDS, isShapeId } from './shapes.ts'

describe('the shape ids', () => {
  it('are twelve, all different', () => {
    expect(SHAPE_IDS).toHaveLength(12)
    expect(new Set(SHAPE_IDS).size).toBe(12)
  })

  it('know which text is a shape', () => {
    expect(isShapeId('heart')).toBe(true)
    expect(isShapeId('X')).toBe(false)
    expect(isShapeId('')).toBe(false)
  })
})
