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
  // The end of the line overshoots the start and hooks inside it, as a hand does when it closes a
  // circle: with a thick line the two have to be well apart to stay two lines.
  circle: ['M40 8 C24 4 8 15 9 33 C10 51 30 59 46 52 C59 46 60 27 51 17 C46 12 41 11 34 17'],
  // Four lines that each go a little past the corner, round and round: the corners stay visible.
  square: ['M6 14 L54 11', 'M53 5 L55 53', 'M59 52 L9 54', 'M12 59 L11 9'],
  diamond: ['M28 8 L56 30 L36 56 L8 31 L32 4'],
  // The line ends past the tip of the lowest-left leg, as a hand that closes the star does.
  star: ['M15 55 L20 36 L6 24 L24 25 L31 7 L40 25 L58 23 L44 36 L49 54 L32 44 L12 59'],
  plus: ['M33 6 L35 58', 'M8 26 L56 27'],
  asterisk: ['M30 7 L33 57', 'M10 16 L55 54', 'M53 13 L14 50'],
  // Upside down, so that the hook where the line closes is at the bottom, inside.
  oval: [
    'M31 58 C43 58 48 44 48 31 C48 16 41 6 31 6 C21 6 16 18 16 32 C16 46 21 57 32 58 C36 58 38 55 38 50',
  ],
  heart: [
    'M32 56 C15 43 8 33 8 23 C8 14 15 8 22 8 C27 8 31 11 32 16 C34 11 38 8 43 8 C50 8 56 14 56 23 C56 33 49 43 32 56 L26 61',
  ],
  // Three battlements, wide apart: more would run together under a thick line.
  // Three battlements, wide apart: more would run together under a thick line. The base goes past the
  // wall on the left and the wall past the base, where the line closes.
  fort: ['M3 57 L56 56 L56 14 L48 14 L48 26 L36 26 L36 14 L28 14 L28 26 L16 26 L16 14 L8 14 L9 61'],
  // Three waves that are not the same: a big one, a small tight one and a long low one.
  waves: [
    'M4 13 Q13 2 22 13 T40 13 T58 15',
    'M8 30 Q13 23 18 30 T28 30 T38 30 T48 30 T58 31',
    'M5 48 Q17 38 29 47 T55 45',
  ],
  goldbar: [
    'M4 30 L46 30 L46 54 L8 54 L8 26',
    'M8 30 L18 18 L56 18 L46 30',
    'M46 30 L56 18 L56 42 L46 54 L42 58',
  ],
}

export function shapeById(id: ShapeId) {
  const shape = SHAPES.find((candidate) => candidate.id === id)
  if (!shape) throw new RangeError(`unknown shape ${id}`)
  return shape
}
