import { useState } from 'react'
import type { GameState } from '../../shared/game/index.ts'
import { arrivalPlan } from '../motion/arrival.ts'
import type { ArrivalPlan } from '../motion/arrival.ts'
import { PATHS } from '../shapes/shapes.ts'
import { shapeOf } from './players.ts'

export interface Arrival {
  /** The cell that got a shape, as an index into `cells`. */
  readonly index: number
  readonly plan: ArrivalPlan
}

/**
 * The shape that was just placed, with the plan for writing it, or null. Only the latest move has
 * one: the next move (or a rematch) replaces it, which is what cuts a running animation short. A
 * board that is first shown with moves on it, or that jumps over several moves at once (a replay
 * dragged along), writes nothing: only a single new shape arrives.
 */
export function useArrival(game: GameState, seed: number): Arrival | null {
  const [seen, setSeen] = useState(game.cells)
  const [arrival, setArrival] = useState<Arrival | null>(null)

  if (seen !== game.cells) {
    setSeen(game.cells)
    const added = game.cells.flatMap((player, index) =>
      player !== null && seen[index] === null ? [index] : [],
    )
    const changed = game.cells.some((player, index) => player !== seen[index])
    if (added.length === 1 && seen.length === game.cells.length) {
      const index = added[0] ?? 0
      const player = game.cells[index]
      if (player != null) {
        const strokes = PATHS[shapeOf(player)].length
        setArrival({ index, plan: arrivalPlan(seed, game.moves.length - 1, strokes) })
      }
    } else if (changed) {
      setArrival(null)
    }
  }

  return arrival
}
