import type { PlayerId } from '../../shared/game/index.ts'
import { shapeOfPlayer } from '../../shared/shapes.ts'
import { useText } from '../i18n/store.ts'
import { useShapeNames } from '../shapes/names.ts'
import type { ShapeId } from '../shapes/shapes.ts'

/**
 * The shape of a player. A player of the game is its shape, so the id is the shape's id; only a
 * game that was kept before the shapes could be chosen has the players X and O.
 */
export function shapeOf(player: PlayerId): ShapeId {
  const shape = shapeOfPlayer(player)
  if (shape) return shape
  throw new RangeError(`unknown player ${player}`)
}

/** What a player is called, in the language of the page. */
export interface PlayerNames {
  /** The name of a player's shape, with a capital: "Kruis". */
  nameOf: (player: PlayerId) => string
  /** What to call a player: the name they typed with their shape, or just the shape ("Anna (kruis)"). */
  labelOf: (player: PlayerId, typed?: string) => string
}

export function usePlayerNames(): PlayerNames {
  const t = useText()
  const shapes = useShapeNames()
  const nameOf = (player: PlayerId) => shapes.title(shapeOf(player))
  return {
    nameOf,
    labelOf: (player, typed) =>
      typed === undefined
        ? nameOf(player)
        : t('player.withShape', { name: typed, shape: shapes.name(shapeOf(player)) }),
  }
}
