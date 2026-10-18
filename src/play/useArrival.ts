import { useState } from 'react'
import type { GameState } from '../../shared/game/index.ts'
import { arrivalPlan } from '../motion/arrival.ts'
import type { ArrivalPlan } from '../motion/arrival.ts'
import { isRing } from '../shapes/closure.ts'
import { strokeLengths } from '../shapes/length.ts'
import { shapeOf } from './players.ts'

/**
 * The shapes that were placed since the board was first shown, with the plan for writing each, by
 * the index of their cell. A shape that is still being written is left to finish when the next move
 * comes (a replay on fast, an opponent who answers at once), so the writing is never cut off and
 * shows the whole shape; one that has been written long since just has its plan, which does
 * nothing again. A shape that is taken off the field (a rematch, a replay that steps back) loses its
 * plan with it. A board that is first shown with moves on it, or that jumps over several moves at
 * once (a replay dragged along), writes nothing: only a single new shape arrives.
 */
export function useArrival(game: GameState, seed: number): ReadonlyMap<number, ArrivalPlan> {
  const [seen, setSeen] = useState(game.cells)
  const [arrivals, setArrivals] = useState<ReadonlyMap<number, ArrivalPlan>>(new Map())

  if (seen !== game.cells) {
    setSeen(game.cells)
    const next = new Map([...arrivals].filter(([index]) => seen[index] === game.cells[index]))
    const added = game.cells.flatMap((player, index) =>
      player !== null && seen[index] === null ? [index] : [],
    )
    const index = added[0]
    const player = index === undefined ? null : game.cells[index]
    if (added.length === 1 && index !== undefined && player != null) {
      const shape = shapeOf(player)
      next.set(index, arrivalPlan(seed, game.moves.length - 1, strokeLengths(shape), isRing(shape)))
    }
    setArrivals(next)
  }

  return arrivals
}
