import { useReducer, useState } from 'react'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { Cell, GameConfig, GameState } from '../../shared/game/index.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { Board } from './Board.tsx'
import { nameOf, playersForRound, shapeOf } from './players.ts'
import './Game.css'

const CLASSIC: Omit<GameConfig, 'players'> = { width: 3, height: 3, winLength: 3 }

interface State {
  /** Which round of the evening this is; the starting player alternates with it. */
  round: number
  game: GameState
}

type Action = { type: 'play'; cell: Cell } | { type: 'rematch' }

function newGame(round: number): State {
  return { round, game: createGame({ ...CLASSIC, players: playersForRound(round) }) }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'rematch') return newGame(state.round + 1)

  const { status } = state.game
  if (status.kind !== 'playing') return state
  const result = applyMove(state.game, { player: status.next, ...action.cell })
  return result.ok ? { ...state, game: result.state } : state
}

function describe(game: GameState): { player: string | null; text: string } {
  const { status } = game
  switch (status.kind) {
    case 'won':
      return { player: status.winner, text: `${nameOf(status.winner)} heeft gewonnen!` }
    case 'draw':
      return { player: null, text: 'Gelijkspel! Niemand heeft gewonnen.' }
    case 'playing':
      return {
        player: status.next,
        text:
          game.moveCount === 0
            ? `${nameOf(status.next)} begint`
            : `${nameOf(status.next)} is aan de beurt`,
      }
  }
}

/** Two players take turns on one screen. */
export function Game() {
  const [{ game }, dispatch] = useReducer(reducer, 0, newGame)
  const [replaying, setReplaying] = useState(false)
  const { player, text } = describe(game)

  if (replaying && game.status.kind !== 'playing') {
    return (
      <Replay
        config={game.config}
        moves={game.moves}
        onClose={() => {
          setReplaying(false)
        }}
      />
    )
  }

  return (
    <section className="game" aria-label="Boter, kaas en eieren">
      <p className="game-status" role="status">
        {player !== null && <ShapeIcon shape={shapeOf(player)} size={32} decorative />}
        <span>{text}</span>
      </p>
      <Board
        game={game}
        onPlay={(cell) => {
          dispatch({ type: 'play', cell })
        }}
      />
      {game.status.kind !== 'playing' && (
        <div className="game-actions">
          <button
            type="button"
            className="rematch"
            onClick={() => {
              dispatch({ type: 'rematch' })
            }}
          >
            Nog een keer
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              setReplaying(true)
            }}
          >
            Kijk terug
          </button>
        </div>
      )}
    </section>
  )
}
