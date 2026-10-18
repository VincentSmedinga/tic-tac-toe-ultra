import { useReducer, useState } from 'react'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { Cell, GameState } from '../../shared/game/index.ts'
import { roomConfig } from '../../shared/room.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import type { ShapeId } from '../shapes/shapes.ts'
import { Board } from './Board.tsx'
import { nameOf, shapeOf } from './players.ts'
import { ShapePicker } from './ShapePicker.tsx'
import './Game.css'

/** The two shapes of a game on one screen, in the order of the players: the first one starts. */
type Shapes = readonly [ShapeId, ShapeId]

interface State {
  /** Which round of the evening this is; the starting player alternates with it. */
  round: number
  game: GameState
}

type Action = { type: 'play'; cell: Cell } | { type: 'rematch'; shapes: Shapes }

/** The game of a round: classic tic-tac-toe, in which the other player starts every round. */
function newGame(round: number, shapes: Shapes): State {
  return { round, game: createGame(roomConfig(round, shapes)) }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'rematch') return newGame(state.round + 1, action.shapes)

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

/** Two players take turns on one screen: first they choose a shape each, then they play. */
export function Game() {
  const [shapes, setShapes] = useState<Shapes | null>(null)
  if (!shapes) return <ChooseShapes onStart={setShapes} />
  return (
    <Play
      shapes={shapes}
      onChooseAgain={() => {
        setShapes(null)
      }}
    />
  )
}

/** Both players choose a shape, the cross and the circle being ready for whoever doesn't care. */
function ChooseShapes({ onStart }: { onStart: (shapes: Shapes) => void }) {
  const [first, setFirst] = useState<ShapeId>('cross')
  const [second, setSecond] = useState<ShapeId>('circle')
  return (
    <section className="game choose-shapes" aria-label="Vormen kiezen">
      <ShapePicker
        label="Speler 1 kiest een vorm"
        value={first}
        taken={{ [second]: 'speler 2' }}
        onChange={setFirst}
      />
      <ShapePicker
        label="Speler 2 kiest een vorm"
        value={second}
        taken={{ [first]: 'speler 1' }}
        onChange={setSecond}
      />
      <button
        type="button"
        className="rematch"
        onClick={() => {
          onStart([first, second])
        }}
      >
        Start
      </button>
    </section>
  )
}

function Play({ shapes, onChooseAgain }: { shapes: Shapes; onChooseAgain: () => void }) {
  const [{ game }, dispatch] = useReducer(reducer, shapes, (chosen) => newGame(0, chosen))
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
              dispatch({ type: 'rematch', shapes })
            }}
          >
            Nog een keer
          </button>
          <button type="button" className="rematch rematch-quiet" onClick={onChooseAgain}>
            Andere vormen
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
