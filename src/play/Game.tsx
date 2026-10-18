import { useReducer, useState } from 'react'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { Cell, GameState } from '../../shared/game/index.ts'
import { CLASSIC_FIELD, DEFAULT_PLAYERS, PLAYER_LIMITS, roomConfig } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { Board } from './Board.tsx'
import { FieldPicker } from './FieldPicker.tsx'
import { fieldLabel } from './field.ts'
import { nameOf, shapeOf } from './players.ts'
import { ShapePicker } from './ShapePicker.tsx'
import './Game.css'

/** The shapes of a game on one screen, in the order of the players: the first one starts. */
type Shapes = readonly ShapeId[]

interface State {
  /** Which round of the evening this is; the starting player alternates with it. */
  round: number
  game: GameState
}

type Action =
  { type: 'play'; cell: Cell } | { type: 'rematch'; shapes: Shapes; field: FieldSettings }

/** The game of a round: classic tic-tac-toe, in which the other player starts every round. */
function newGame(round: number, shapes: Shapes, field: FieldSettings): State {
  return { round, game: createGame(roomConfig(round, shapes, field)) }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'rematch') return newGame(state.round + 1, action.shapes, action.field)

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

/** Two players take turns on one screen: first they choose a shape each and the field, then they play. */
export function Game() {
  const [chosen, setChosen] = useState<{ shapes: Shapes; field: FieldSettings } | null>(null)
  if (!chosen) {
    return (
      <ChooseShapes
        onStart={(shapes, field) => {
          setChosen({ shapes, field })
        }}
      />
    )
  }
  return (
    <Play
      shapes={chosen.shapes}
      field={chosen.field}
      onChooseAgain={() => {
        setChosen(null)
      }}
    />
  )
}

/** The shapes that are ready for this many players: the first ones, for whoever doesn't care. */
function defaultShapes(count: number): ShapeId[] {
  return SHAPES.slice(0, count).map(({ id }) => id)
}

/** Everybody chooses a shape, the cross and the circle being ready for the first two players. */
function ChooseShapes({ onStart }: { onStart: (shapes: Shapes, field: FieldSettings) => void }) {
  const [shapes, setShapes] = useState<ShapeId[]>(defaultShapes(DEFAULT_PLAYERS))
  const [field, setField] = useState<FieldSettings>(CLASSIC_FIELD)

  // More players get the first shapes that are free, fewer players leave the last ones out.
  const setCount = (count: number) => {
    setShapes((current) => {
      if (count <= current.length) return current.slice(0, count)
      const free = SHAPES.map(({ id }) => id).filter((id) => !current.includes(id))
      return [...current, ...free.slice(0, count - current.length)]
    })
  }

  return (
    <section className="game choose-shapes" aria-label="Vormen kiezen">
      <div className="field">
        <label htmlFor="local-player-count">Aantal spelers</label>
        <select
          id="local-player-count"
          className="player-count"
          value={shapes.length}
          onChange={(event) => {
            setCount(Number(event.target.value))
          }}
        >
          {Array.from(
            { length: PLAYER_LIMITS.max - PLAYER_LIMITS.min + 1 },
            (_, index) => PLAYER_LIMITS.min + index,
          ).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>
      {shapes.map((shape, index) => (
        <ShapePicker
          key={index}
          label={`Speler ${(index + 1).toString()} kiest een vorm`}
          value={shape}
          taken={Object.fromEntries(
            shapes.flatMap((other, otherIndex) =>
              otherIndex === index ? [] : [[other, `speler ${(otherIndex + 1).toString()}`]],
            ),
          )}
          onChange={(chosen) => {
            setShapes((current) => current.map((old, at) => (at === index ? chosen : old)))
          }}
        />
      ))}
      <FieldPicker value={field} onChange={setField} />
      <button
        type="button"
        className="rematch"
        onClick={() => {
          onStart(shapes, field)
        }}
      >
        Start
      </button>
    </section>
  )
}

function Play({
  shapes,
  field,
  onChooseAgain,
}: {
  shapes: Shapes
  field: FieldSettings
  onChooseAgain: () => void
}) {
  const [{ game }, dispatch] = useReducer(reducer, undefined, () => newGame(0, shapes, field))
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
    <section className="game" aria-label="Boter, Kaas en Eieren Ultra">
      <p className="game-status" role="status">
        {player !== null && <ShapeIcon shape={shapeOf(player)} size={32} decorative />}
        <span>{text}</span>
      </p>
      <p className="field-label">{fieldLabel(field)}</p>
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
              dispatch({ type: 'rematch', shapes, field })
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
