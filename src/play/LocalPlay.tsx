import { useReducer, useState } from 'react'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { Cell, GameState } from '../../shared/game/index.ts'
import { roomConfig } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { Wallpaper } from '../appearance/Wallpaper.tsx'
import { useText } from '../i18n/store.ts'
import type { Text } from '../i18n/types.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import type { ShapeId } from '../shapes/shapes.ts'
import { navigate } from '../online/route.ts'
import { useScrollToTop } from '../online/scroll.ts'
import { Board } from './Board.tsx'
import type { Opponent } from './computer.ts'
import { fieldLabel } from './field.ts'
import { usePlayMode } from './playMode.ts'
import { PlayModeButton } from './PlayModeButton.tsx'
import { usePlayerNames, shapeOf } from './players.ts'
import type { PlayerNames } from './players.ts'
import { useComputerMove } from './useComputerMove.ts'
import './Game.css'
import './PlayMode.css'

/** The shapes of a game on one screen, in the order of the players: the first one starts. */
type Shapes = readonly ShapeId[]

interface State {
  /** Which round of the evening this is; the starting player alternates with it. */
  round: number
  game: GameState
}

type Action =
  { type: 'play'; cell: Cell } | { type: 'rematch'; shapes: Shapes; field: FieldSettings }

/** The game of a round, in which the other player starts every round. */
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

function describe(
  t: Text,
  { nameOf }: PlayerNames,
  game: GameState,
): { player: string | null; text: string } {
  const { status } = game
  switch (status.kind) {
    case 'won':
      return { player: status.winner, text: t('status.won', { name: nameOf(status.winner) }) }
    case 'draw':
      return { player: null, text: t('status.draw') }
    case 'playing':
      return {
        player: status.next,
        text: t(game.moveCount === 0 ? 'status.starts' : 'status.turn', {
          name: nameOf(status.next),
        }),
      }
  }
}

/** What the status line says in a game against the computer: you are "you", it is "the computer". */
function describeAgainst(
  t: Text,
  computer: ShapeId,
  game: GameState,
): { player: string | null; text: string; moved: string | null } {
  const { status } = game
  const last = game.moves.at(-1)
  // For who can't see the board: where the computer played, said with what comes next.
  const moved =
    last?.player === computer ? t('computer.moved', { row: last.y + 1, column: last.x + 1 }) : null
  switch (status.kind) {
    case 'won':
      return {
        player: status.winner,
        text: t(status.winner === computer ? 'computer.won' : 'status.youWon'),
        moved,
      }
    case 'draw':
      return { player: null, text: t('status.draw'), moved }
    case 'playing': {
      const text =
        status.next === computer
          ? t('computer.thinking')
          : t(game.moveCount === 0 ? 'status.youStart' : 'status.yourTurn')
      return { player: status.next, text, moved }
    }
  }
}

interface LocalPlayProps {
  /** The players of the first round, in turn order. */
  shapes: Shapes
  field: FieldSettings
  /** Set when one of the shapes is played by the computer. */
  opponent?: Opponent
  onChooseAgain: () => void
}

/**
 * A game on this screen alone, from the first move to the next round: between people who share the
 * screen, or against the computer. The engine runs here; nothing is sent or kept anywhere.
 */
export function LocalPlay({ shapes, field, opponent, onChooseAgain }: LocalPlayProps) {
  const [{ game }, dispatch] = useReducer(reducer, undefined, () => newGame(0, shapes, field))
  // The replay, from its start or from its summary ("Bekijk samenvatting").
  const [replaying, setReplaying] = useState<false | 'replay' | 'summary'>(false)
  // The board and its replay are two views of the screen, each starting at the top.
  useScrollToTop(replaying ? 'replay' : 'board')
  const t = useText()
  const names = usePlayerNames()
  const { player, text, moved } = opponent
    ? describeAgainst(t, opponent.shape, game)
    : { ...describe(t, names, game), moved: null }
  const computerTurn = game.status.kind === 'playing' && game.status.next === opponent?.shape
  useComputerMove(game, opponent, (cell) => {
    dispatch({ type: 'play', cell })
  })
  /** What a player is called in the row of the full screen mode. */
  const rowName = (shape: ShapeId) => {
    if (!opponent) return names.nameOf(shape)
    return t(shape === opponent.shape ? 'computer.name' : 'computer.you')
  }
  const {
    on: modeOn,
    attachLayer,
    attachTrigger,
    toggle: toggleMode,
    close: closeMode,
  } = usePlayMode()

  if (replaying && game.status.kind !== 'playing') {
    return (
      <Replay
        config={game.config}
        moves={game.moves}
        startAtSummary={replaying === 'summary'}
        onClose={() => {
          setReplaying(false)
        }}
      />
    )
  }

  return (
    <section
      ref={attachLayer}
      className="game"
      aria-label={t('app.title')}
      data-play-mode={modeOn || undefined}
    >
      {modeOn && <Wallpaper />}
      <div className="game-info">
        {modeOn && (
          <div className="players players-row">
            {shapes.map((shape) => (
              <div key={shape} className="player" data-turn={shape === player || undefined}>
                <ShapeIcon shape={shape} size={28} decorative />
                <span>{rowName(shape)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="game-status" role="status">
          {player !== null && <ShapeIcon shape={shapeOf(player)} size={32} decorative />}
          <span>
            {moved !== null && <span className="sr-only">{moved} </span>}
            {text}
          </span>
        </p>
        <p className="field-label">{fieldLabel(t, field)}</p>
        {opponent && <p className="field-label">{opponent.label}</p>}
        <PlayModeButton on={modeOn} toggle={toggleMode} attachTrigger={attachTrigger} />
      </div>
      <Board
        game={game}
        interactive={!computerTurn}
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
            {t('play.rematch')}
          </button>
          <button type="button" className="rematch rematch-quiet" onClick={onChooseAgain}>
            {t(opponent ? 'computer.change' : 'play.otherShapes')}
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              // The replay is a screen of its own, not part of the mode.
              closeMode()
              setReplaying('replay')
            }}
          >
            {t('play.replay')}
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              closeMode()
              setReplaying('summary')
            }}
          >
            {t('summary.show')}
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              closeMode()
              navigate('/')
            }}
          >
            {t('play.leave')}
          </button>
        </div>
      )}
    </section>
  )
}
