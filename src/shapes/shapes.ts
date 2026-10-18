/**
 * The shapes a player can have: the first set, drawn by hand (docs/reference/shapes.png). A
 * player is assigned one of these; the game engine only knows the player's id. The Dutch names
 * are confirmed by the person who drew the shapes.
 */
export const SHAPES = [
  { id: 'cross', name: 'kruis', marker: 'vivid red 4' },
  { id: 'circle', name: 'cirkel', marker: 'royal blue 70' },
  { id: 'square', name: 'vierkant', marker: 'grass green 47' },
  { id: 'diamond', name: 'ruit', marker: 'ultramarine 73' },
  { id: 'star', name: 'ster', marker: 'WG8' },
  { id: 'plus', name: 'plus', marker: 'vivid pink 6' },
  { id: 'asterisk', name: 'sterretje', marker: 'ice blue 65' },
] as const

export type ShapeId = (typeof SHAPES)[number]['id']

/** The paths of each shape on a 64 × 64 field, drawn with a slight wobble like the originals. */
export const PATHS: Record<ShapeId, readonly string[]> = {
  cross: ['M14 12 C24 28 36 44 49 54', 'M52 11 C40 24 26 40 11 53'],
  circle: ['M38 10 C24 6 9 16 10 33 C11 50 30 58 45 52 C58 47 60 28 51 18 C46 12 38 9 29 12'],
  square: ['M11 13 L52 11 L54 51 L12 52 L11 12'],
  diamond: ['M28 8 L56 30 L36 56 L8 31 Z'],
  star: ['M31 7 L40 25 L58 23 L44 36 L49 54 L32 44 L15 55 L20 36 L6 24 L24 25 Z'],
  plus: ['M33 6 L35 58', 'M8 26 L56 27'],
  asterisk: ['M30 7 L33 57', 'M10 16 L55 54', 'M53 13 L14 50'],
}

export function shapeById(id: ShapeId) {
  const shape = SHAPES.find((candidate) => candidate.id === id)
  if (!shape) throw new RangeError(`unknown shape ${id}`)
  return shape
}
