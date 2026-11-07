import type { ShapeId } from '../../shared/shapes.ts'

/** One shape of the set: its id and where its drawing comes from (a marker, or a script or a symbol). */
export interface ShapeInfo {
  readonly id: ShapeId
  /** The marker the shape was drawn with on paper (docs/reference/shapes.png, shapes-2.png). */
  readonly marker?: string
  /** What the shape is taken from: a letter of an alphabet, or a symbol. */
  readonly origin?: string
}

/**
 * The shapes a player can have. The first twelve were drawn by hand (docs/reference/shapes.png has
 * the first seven, shapes-2.png adds the other five), each with a marker. The other twenty-four
 * were drawn on the same 64 × 64 field in the same thick, slightly wobbly line: most are a letter
 * of an alphabet or a writing system (Greek, Japanese, Chinese, Korean, Arabic, Cyrillic, Runic,
 * Devanagari, Hebrew, Braille, Ogham, an Egyptian hieroglyph), the rest are symbols. A player is
 * assigned one of these; the game engine only knows the player's id. Their names are in the
 * dictionaries (`shape.<id>`).
 */
export const SHAPES: readonly ShapeInfo[] = [
  { id: 'cross', marker: 'vivid red 4' },
  { id: 'circle', marker: 'royal blue 70' },
  { id: 'square', marker: 'grass green 47' },
  { id: 'diamond', marker: 'ultramarine 73' },
  { id: 'star', marker: 'WG8' },
  { id: 'plus', marker: 'vivid pink 6' },
  { id: 'asterisk', marker: 'ice blue 65' },
  { id: 'oval', marker: 'viridian 54' },
  { id: 'heart', marker: 'wine red 1' },
  { id: 'fort', marker: 'prussian blue 69' },
  { id: 'waves', marker: 'orange 23' },
  { id: 'goldbar', marker: 'lemon yellow 35' },
  { id: 'omega', origin: 'Greek Ω, omega' },
  { id: 'psi', origin: 'Greek Ψ, psi' },
  { id: 'sigma', origin: 'Greek Σ, sigma' },
  { id: 'pi', origin: 'Greek π, pi' },
  { id: 'curl', origin: 'Japanese hiragana の, no' },
  { id: 'person', origin: 'Chinese 人, person' },
  { id: 'middle', origin: 'Chinese 中, middle' },
  { id: 'hangul', origin: 'Korean hangul ㅎ, hieut' },
  { id: 'bowl', origin: 'Arabic ن, noon' },
  { id: 'ya', origin: 'Cyrillic Я, ya' },
  { id: 'bowtie', origin: 'Runic ᛞ, dagaz' },
  { id: 'thorn', origin: 'Runic ᚦ, thurisaz' },
  { id: 'pa', origin: 'Devanagari प, pa' },
  { id: 'aleph', origin: 'Hebrew א, aleph' },
  { id: 'braille', origin: 'Braille dots' },
  { id: 'ogham', origin: 'Ogham ᚋ, muin' },
  { id: 'ankh', origin: 'Egyptian hieroglyph ☥, ankh' },
  { id: 'infinity', origin: 'the sign for infinity ∞' },
  { id: 'triangle', origin: 'a triangle' },
  { id: 'moon', origin: 'a crescent moon' },
  { id: 'bolt', origin: 'a lightning bolt' },
  { id: 'drop', origin: 'a drop of water' },
  { id: 'anchor', origin: 'an anchor' },
  { id: 'eye', origin: 'an eye' },
]

/** The ids are shared with the room, which has to know which shapes exist (shared/shapes.ts). */
export type { ShapeId }

/** The paths of each shape on a 64 × 64 field, drawn with a slight wobble like the originals. */
export const PATHS: Record<ShapeId, readonly string[]> = {
  cross: ['M14 12 C24 28 36 44 49 54', 'M52 11 C40 24 26 40 11 53'],
  // The end of the line overshoots the start and hooks inside it, as a hand does when it closes a
  // circle: with a thick line the two have to be well apart to stay two lines.
  circle: ['M40 8 C24 4 8 15 9 33 C10 51 30 59 46 52 C59 46 60 27 51 17 C46 12 41 11 34 17'],
  // Four lines that each go a little past the corner, round and round: the corners stay visible.
  square: ['M6 14 L54 11', 'M53 5 L55 53', 'M59 52 L9 54', 'M12 59 L11 9'],
  // Turned a quarter to the right: the end that sticks out is on the right now.
  diamond: ['M56 28 L34 56 L8 36 L33 8 L60 32'],
  // The line closes by crossing the first one a little below the top tip.
  star: ['M30 6 L40 25 L58 23 L44 36 L49 54 L32 44 L15 55 L20 36 L6 24 L24 25 L35 12'],
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
    'M8 30 L46 30 L46 54 L8 54 Z',
    'M8 30 L18 18 L56 18 L46 30',
    'M46 30 L56 18 L56 42 L46 54',
  ],
  // The two feet of the omega turn outwards, as a pen leaves them.
  omega: [
    'M7 55 L23 54 C13 47 9 37 9 28 C9 15 19 7 32 7 C45 7 56 15 56 28 C56 37 51 47 41 54 L57 55',
  ],
  psi: ['M11 9 C11 38 17 46 32 46 C47 46 53 38 53 9', 'M32 5 L33 59'],
  sigma: ['M51 15 L51 10 L13 11 L35 32 L12 53 L53 52 L53 46'],
  pi: [
    'M7 17 C20 13 40 15 57 12',
    'M22 16 C21 30 20 42 19 54',
    'M43 14 C42 32 42 46 50 53 C53 55 56 54 57 52',
  ],
  // A spiral that starts inside and winds out: the turns stay far enough apart for a thick line.
  curl: ['M32 32 C26 28 18 34 18 43 C18 56 38 60 49 50 C60 40 56 18 40 11 C28 6 14 12 9 25'],
  person: ['M31 7 C31 28 23 44 9 55', 'M30 24 C34 38 44 49 57 55'],
  middle: ['M10 19 L53 18 L53 43 L11 44 L11 16', 'M32 6 L31 59'],
  hangul: [
    'M32 4 L32 10',
    'M12 16 L52 16',
    'M32 26 C22 26 16 33 17 42 C18 52 28 58 38 56 C48 54 52 44 49 36 C46 28 40 26 33 27',
  ],
  // The dot of the noon is a short stroke too (see braille).
  bowl: ['M9 16 C9 40 20 54 32 54 C46 54 56 40 55 16', 'M30 26 L33 31'],
  ya: ['M50 7 L51 57', 'M50 8 L27 8 C13 8 13 31 27 31 L50 31', 'M28 32 L12 57'],
  bowtie: ['M10 11 L11 54 L53 10 L54 55 L10 11 L13 17'],
  thorn: ['M20 5 L21 59', 'M21 18 L45 32 L21 46'],
  pa: ['M7 14 L57 15', 'M44 15 L45 57', 'M44 30 C30 26 16 29 17 40 C18 51 33 50 44 43'],
  aleph: ['M51 8 L14 56', 'M12 9 L12 22 L27 29', 'M52 55 L52 42 L37 35'],
  // Five dots of a braille cell (the middle one on the left is left out), each a short stroke, so that it still has a direction to be written in.
  braille: ['M22 10 L23 16', 'M22 48 L23 54', 'M42 10 L43 16', 'M42 29 L43 35', 'M42 48 L43 54'],
  // A stem with three slanting strokes across it.
  ogham: ['M5 33 L59 32', 'M12 20 L22 46', 'M26 18 L36 46', 'M40 18 L50 46'],
  ankh: ['M31 58 L32 34 C19 30 17 8 32 7 C47 8 46 30 33 34', 'M11 37 L53 36'],
  infinity: ['M32 32 C38 20 56 16 57 32 C58 48 40 44 32 32 C25 20 7 16 7 32 C7 48 24 44 31 31'],
  triangle: ['M32 8 L58 53 L7 55 L28 14'],
  moon: ['M44 8 C20 8 8 24 10 38 C13 54 34 62 52 50 C34 50 25 34 30 20 C33 13 38 10 44 8'],
  // One line with two bends: a closed outline would fill up under a thick line.
  bolt: ['M42 5 L18 34 L34 33 L23 60'],
  drop: ['M32 6 C26 18 12 32 12 43 C12 54 22 59 32 59 C43 59 52 54 52 43 C52 32 38 18 32 6 L29 12'],
  anchor: [
    'M32 5 C24 5 24 19 32 19 C40 19 40 5 32 5',
    'M32 19 L32 58',
    'M20 29 L44 29',
    'M9 36 C11 52 22 58 32 57 C42 58 53 52 55 36',
  ],
  eye: ['M5 32 C18 14 46 14 59 32 C46 50 18 50 5 32', 'M30 28 L33 34'],
}

export function shapeById(id: ShapeId) {
  const shape = SHAPES.find((candidate) => candidate.id === id)
  if (!shape) throw new RangeError(`unknown shape ${id}`)
  return shape
}
