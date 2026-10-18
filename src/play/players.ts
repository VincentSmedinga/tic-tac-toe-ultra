import type { PlayerId } from '../../shared/game/index.ts'
import { SHAPES, shapeById } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'

/** The two players of classic tic-tac-toe, and the shape each one has. */
export const PLAYERS: readonly { id: PlayerId; shape: ShapeId }[] = [
  { id: 'X', shape: 'cross' },
  { id: 'O', shape: 'circle' },
]

/** The shape of a player: X and O have the cross and the circle, any other player id that is a shape's id has that shape. */
export function shapeOf(player: PlayerId): ShapeId {
  const found = PLAYERS.find(({ id }) => id === player)
  if (found) return found.shape
  const shape = SHAPES.find(({ id }) => id === player)
  if (!shape) throw new RangeError(`unknown player ${player}`)
  return shape.id
}

/** The name of a player's shape, with a capital: "Kruis". */
export function nameOf(player: PlayerId): string {
  const { name } = shapeById(shapeOf(player))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** The players in turn order for a round: every round the other player starts. */
export function playersForRound(round: number): readonly PlayerId[] {
  const ids = PLAYERS.map(({ id }) => id)
  const shift = round % ids.length
  return [...ids.slice(shift), ...ids.slice(0, shift)]
}
