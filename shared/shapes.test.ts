import { describe, expect, it } from 'vitest'
import { SHAPE_IDS, isShapeId } from './shapes.ts'

describe('the shape ids', () => {
  it('are thirty-six, all different', () => {
    expect(SHAPE_IDS).toHaveLength(36)
    expect(new Set(SHAPE_IDS).size).toBe(36)
  })

  it('know which text is a shape', () => {
    expect(isShapeId('heart')).toBe(true)
    expect(isShapeId('X')).toBe(false)
    expect(isShapeId('')).toBe(false)
  })
})
