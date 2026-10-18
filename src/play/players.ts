import type { PlayerId } from '../../shared/game/index.ts'
import { isShapeId } from '../../shared/shapes.ts'
import { shapeById } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'

/** Games kept before the shapes could be chosen have the players X and O: the cross and the circle. */
const EARLIER_PLAYERS: ReadonlyMap<string, ShapeId> = new Map([
  ['X', 'cross'],
  ['O', 'circle'],
])

/**
 * The shape of a player. A player of the game is its shape, so the id is the shape's id; only a
 * game that was kept before the shapes could be chosen has the players X and O.
 */
export function shapeOf(player: PlayerId): ShapeId {
  if (isShapeId(player)) return player
  const earlier = EARLIER_PLAYERS.get(player)
  if (earlier) return earlier
  throw new RangeError(`unknown player ${player}`)
}

/** The name of a player's shape, with a capital: "Kruis". */
export function nameOf(player: PlayerId): string {
  const { name } = shapeById(shapeOf(player))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** What to call a player: the name they typed with their shape, or just the shape ("Anna (kruis)"). */
export function labelOf(player: PlayerId, typed?: string): string {
  return typed === undefined ? nameOf(player) : `${typed} (${nameOf(player).toLowerCase()})`
}
