/**
 * The ids of the twelve shapes a player can have (the drawings, names and colours are in src/shapes/).
 * They are shared because the room has to know which ones exist, and because the shape is what a
 * player is in the game: the engine's player id is the id of the shape.
 */
export const SHAPE_IDS = [
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
] as const

export type ShapeId = (typeof SHAPE_IDS)[number]

export function isShapeId(value: string): value is ShapeId {
  return (SHAPE_IDS as readonly string[]).includes(value)
}

/** Games kept before the shapes could be chosen have the players X and O: the cross and the circle. */
const EARLIER_PLAYERS: ReadonlyMap<string, ShapeId> = new Map([
  ['X', 'cross'],
  ['O', 'circle'],
])

/**
 * The shape of a player of a game: the player's id is the shape's id, except in a game kept before
 * the shapes could be chosen, which has X and O. Null for anything else.
 */
export function shapeOfPlayer(player: string): ShapeId | null {
  return isShapeId(player) ? player : (EARLIER_PLAYERS.get(player) ?? null)
}
