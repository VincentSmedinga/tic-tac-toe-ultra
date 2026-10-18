/**
 * The shapes a player can have: the sets drawn by hand (docs/reference/shapes.png has the first
 * seven, shapes-2.png adds the other five). A player is assigned one of these; the game engine
 * only knows the player's id. The Dutch names are chosen by the person who drew the shapes.
 */
export const SHAPES = [
  { id: 'cross', name: 'kruis', marker: 'vivid red 4' },
  { id: 'circle', name: 'cirkel', marker: 'royal blue 70' },
  { id: 'square', name: 'vierkant', marker: 'grass green 47' },
  { id: 'diamond', name: 'ruit', marker: 'ultramarine 73' },
  { id: 'star', name: 'ster', marker: 'WG8' },
  { id: 'plus', name: 'plus', marker: 'vivid pink 6' },
  { id: 'asterisk', name: 'sterretje', marker: 'ice blue 65' },
  { id: 'oval', name: 'ovaal', marker: 'viridian 54' },
  { id: 'heart', name: 'hart', marker: 'wine red 1' },
  { id: 'fort', name: 'fort', marker: 'prussian blue 69' },
  { id: 'waves', name: 'golven', marker: 'orange 23' },
  { id: 'goldbar', name: 'goudstaaf', marker: 'lemon yellow 35' },
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
  oval: ['M31 6 C43 6 48 20 48 33 C48 48 41 58 31 58 C21 58 16 46 16 32 C16 18 21 7 32 6'],
  heart: [
    'M32 56 C15 43 8 33 8 23 C8 14 15 8 22 8 C27 8 31 11 32 16 C34 11 38 8 43 8 C50 8 56 14 56 23 C56 33 49 43 32 56 Z',
  ],
  fort: [
    'M8 56 L8 22 L13 22 L13 16 L19 16 L19 22 L24 22 L24 16 L30 16 L30 30 L38 30 L38 16 L44 16 L44 22 L49 22 L49 16 L56 16 L56 56 Z',
  ],
  waves: [
    'M6 14 Q14 5 22 14 T38 14 T55 14',
    'M6 30 Q14 21 22 30 T38 30 T55 30',
    'M6 46 Q14 37 22 46 T38 46 T55 46',
  ],
  goldbar: [
    'M8 30 L46 30 L46 54 L8 54 Z',
    'M8 30 L18 18 L56 18 L46 30',
    'M46 30 L56 18 L56 42 L46 54',
  ],
}

export function shapeById(id: ShapeId) {
  const shape = SHAPES.find((candidate) => candidate.id === id)
  if (!shape) throw new RangeError(`unknown shape ${id}`)
  return shape
}
