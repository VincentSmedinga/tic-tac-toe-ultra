import { useState } from 'react'
import type { ReactNode } from 'react'
import { replayGame } from '../../shared/game/index.ts'
import type { GameState } from '../../shared/game/index.ts'
import type { ClientMessage, StateMessage } from '../../shared/protocol.ts'
import { Wallpaper } from '../appearance/Wallpaper.tsx'
import { useFormat } from '../i18n/format.ts'
import { useText } from '../i18n/store.ts'
import type { Text } from '../i18n/types.ts'
import { Board } from '../play/Board.tsx'
import { fieldLabel } from '../play/field.ts'
import { usePlayMode } from '../play/playMode.ts'
import { PlayModeButton } from '../play/PlayModeButton.tsx'
import { usePlayerNames, shapeOf } from '../play/players.ts'
import type { PlayerNames } from '../play/players.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import type { StartedState } from './started.ts'
import { useScrollToTop } from './scroll.ts'
import '../play/Game.css'
import '../play/PlayMode.css'
import './Online.css'

interface OnlineGameProps {
  state: StartedState
  send: (message: ClientMessage) => void
  /** What the room has to say about its connection: it goes with the game, also over the whole screen. */
  banner?: ReactNode
}

/** The name a player goes by: the one they typed, or their shape ("Kruis"). `shape` is the player of the game. */
function displayName(state: StateMessage, { nameOf }: PlayerNames, shape: string): string {
  return state.players.find((player) => player.shape === shape)?.name ?? nameOf(shape)
}

/** The shape of the player who reads this. */
function myShapeOf(state: StateMessage): string | undefined {
  return state.players.find((player) => player.id === state.you)?.shape
}

/** What the status line says, from the point of view of the player who reads it. */
function statusText(t: Text, names: PlayerNames, state: StateMessage, game: GameState): string {
  const { status } = game
  if (status.kind === 'draw') return t('status.draw')
  if (status.kind === 'won') {
    return status.winner === myShapeOf(state)
      ? t('status.youWon')
      : t('status.won', { name: displayName(state, names, status.winner) })
  }
  const starts = game.moveCount === 0
  if (status.next === myShapeOf(state)) return t(starts ? 'status.youStart' : 'status.yourTurn')
  return t(starts ? 'status.starts' : 'status.turn', {
    name: displayName(state, names, status.next),
  })
}

/** The game of a room: both players, whose turn it is, the board, and a rematch at the end. */
export function OnlineGame({ state, send, banner }: OnlineGameProps) {
  const t = useText()
  const {
    on: modeOn,
    attachLayer,
    attachTrigger,
    toggle: toggleMode,
    close: closeMode,
  } = usePlayMode()
  const { list } = useFormat()
  const names = usePlayerNames()
  // The round whose replay is open, so a rematch can't leave it open for the next round.
  const [replayRound, setReplayRound] = useState<number | null>(null)
  // The game and its replay are two views of the room, each starting at the top.
  useScrollToTop(replayRound === state.round ? 'replay' : 'game')
  const replayed = replayGame(state.config, state.moves)
  if (!replayed.ok) {
    // The room only sends moves that replay, so this is a message that came out wrong.
    return (
      <>
        {banner}
        <p className="message" role="alert">
          {t('online.broken')}
        </p>
      </>
    )
  }
  const game = replayed.state
  // A rematch started by the other player ends the replay: there is a new game to play.
  if (replayRound === state.round && game.status.kind !== 'playing') {
    return (
      <>
        {banner}
        <Replay
          config={state.config}
          moves={state.moves}
          players={state.players.flatMap(({ shape, name }) =>
            shape === undefined ? [] : [{ id: shape, name }],
          )}
          onClose={() => {
            setReplayRound(null)
          }}
        />
      </>
    )
  }
  const myTurn = game.status.kind === 'playing' && game.status.next === myShapeOf(state)
  const away = state.players.filter((player) => player.id !== state.you && !player.connected)

  const toPlay = game.status.kind === 'playing' ? game.status.next : undefined

  return (
    <section
      ref={attachLayer}
      className="game online-game"
      aria-label={t('online.label')}
      data-play-mode={modeOn || undefined}
    >
      {modeOn && <Wallpaper />}
      <div className="game-info">
        {banner}

        <div className="players players-row">
          {state.players.map((player) =>
            player.shape === undefined ? null : (
              <div
                key={player.id}
                className="player"
                data-you={player.id === state.you || undefined}
                data-turn={player.shape === toPlay || undefined}
              >
                <ShapeIcon shape={player.shape} size={28} decorative />
                <span>
                  {player.id === state.you
                    ? t('player.youShort', { name: displayName(state, names, player.shape) })
                    : displayName(state, names, player.shape)}
                </span>
              </div>
            ),
          )}
        </div>

        {away.length > 0 && (
          <p className="message" role="status">
            {t('online.away', {
              names: list(away.map((player) => displayName(state, names, player.shape ?? ''))),
              count: away.length,
            })}
          </p>
        )}

        <p className="game-status" role="status">
          {game.status.kind !== 'draw' && (
            <ShapeIcon
              shape={shapeOf(game.status.kind === 'won' ? game.status.winner : game.status.next)}
              size={32}
              decorative
            />
          )}
          <span>{statusText(t, names, state, game)}</span>
        </p>

        <p className="field-label">{fieldLabel(t, state.field)}</p>
        <PlayModeButton on={modeOn} toggle={toggleMode} attachTrigger={attachTrigger} />
      </div>

      <Board
        game={game}
        interactive={myTurn}
        onPlay={(cell) => {
          send({ type: 'move', x: cell.x, y: cell.y })
        }}
      />

      {game.status.kind !== 'playing' && (
        <div className="game-actions">
          <button
            type="button"
            className="rematch"
            onClick={() => {
              send({ type: 'rematch' })
            }}
          >
            {t('play.rematch')}
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              // The replay is a screen of its own, not part of the mode.
              closeMode()
              setReplayRound(state.round)
            }}
          >
            {t('play.replay')}
          </button>
        </div>
      )}
    </section>
  )
}
