import type { ShapeId } from './shapes.ts'

/**
 * The shapes whose strokes follow each other round the shape, in the order of their paths (the
 * square: top, right, bottom, left). A hand writes those going round, so the plan starts at any of
 * the strokes and goes round one way or the other, instead of shuffling them. The other shapes that
 * close on themselves (the circle, the oval, the diamond) are one line, which is written from one
 * end to the other, with the clock or against it.
 */
const RINGS: readonly ShapeId[] = ['square']

export function isRing(shape: ShapeId): boolean {
  return RINGS.includes(shape)
}
