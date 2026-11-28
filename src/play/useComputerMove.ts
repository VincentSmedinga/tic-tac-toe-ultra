import { useEffect, useEffectEvent } from 'react'
import type { Cell, GameState } from '../../shared/game/index.ts'
import { newSeed } from '../motion/random.ts'
import type { Opponent } from './computer.ts'

/**
 * Makes the computer's move when it is its turn: it is asked at once, and the move is played when it
 * has answered and its pause is over. A game that changes meanwhile (the next round, back to the
 * choices) drops the answer.
 */
export function useComputerMove(
  game: GameState,
  opponent: Opponent | undefined,
  play: (cell: Cell) => void,
): void {
  const move = useEffectEvent((signal: AbortSignal) => {
    if (!opponent || game.status.kind !== 'playing' || game.status.next !== opponent.shape) return
    const started = Date.now()
    const wait = opponent.pause(game.config)
    void opponent.think(game, opponent.shape, opponent.bot, newSeed()).then((cell) => {
      if (!cell || signal.aborted) return
      const timer = setTimeout(
        () => {
          play(cell)
        },
        Math.max(0, wait - (Date.now() - started)),
      )
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
      })
    })
  })

  // Once for every position, whatever else changes on the screen.
  useEffect(() => {
    const controller = new AbortController()
    move(controller.signal)
    return () => {
      controller.abort()
    }
  }, [game])
}
