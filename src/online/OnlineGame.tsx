import { useState } from 'react'
import { replayGame } from '../../shared/game/index.ts'
import type { GameState } from '../../shared/game/index.ts'
import type { ClientMessage, StateMessage } from '../../shared/protocol.ts'
import { Board } from '../play/Board.tsx'
import { fieldLabel } from '../play/field.ts'
import { nameOf, shapeOf } from '../play/players.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import type { StartedState } from './started.ts'
import '../play/Game.css'
import './Online.css'

interface OnlineGameProps {
  state: StartedState
  send: (message: ClientMessage) => void
}

/** The name a player goes by: the one they typed, or their shape ("Kruis"). `shape` is the player of the game. */
function displayName(state: StateMessage, shape: string): string {
  return state.players.find((player) => player.shape === shape)?.name ?? nameOf(shape)
}

/** The shape of the player who reads this. */
function myShapeOf(state: StateMessage): string | undefined {
  return state.players.find((player) => player.id === state.you)?.shape
}

/** What the status line says, from the point of view of the player who reads it. */
function statusText(state: StateMessage, game: GameState): string {
  const { status } = game
  if (status.kind === 'draw') return 'Gelijkspel! Niemand heeft gewonnen.'
  if (status.kind === 'won') {
    return status.winner === myShapeOf(state)
      ? 'Je hebt gewonnen!'
      : `${displayName(state, status.winner)} heeft gewonnen!`
  }
  const starts = game.moveCount === 0
  if (status.next === myShapeOf(state)) return starts ? 'Jij begint' : 'Jij bent aan de beurt'
  return `${displayName(state, status.next)} ${starts ? 'begint' : 'is aan de beurt'}`
}

/** The game of a room: both players, whose turn it is, the board, and a rematch at the end. */
export function OnlineGame({ state, send }: OnlineGameProps) {
  // The round whose replay is open, so a rematch can't leave it open for the next round.
  const [replayRound, setReplayRound] = useState<number | null>(null)
  const replayed = replayGame(state.config, state.moves)
  if (!replayed.ok) {
    // The room only sends moves that replay, so this is a message that came out wrong.
    return (
      <p className="message" role="alert">
        Er ging iets mis met het spel. Ga terug naar het begin en maak een nieuwe kamer.
      </p>
    )
  }
  const game = replayed.state
  // A rematch started by the other player ends the replay: there is a new game to play.
  if (replayRound === state.round && game.status.kind !== 'playing') {
    return (
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
    )
  }
  const myTurn = game.status.kind === 'playing' && game.status.next === myShapeOf(state)
  // You may take your move back until the next player has moved: then it is theirs that came last.
  const canUndo =
    game.status.kind === 'playing' &&
    game.moveCount > 0 &&
    game.moves.at(-1)?.player === myShapeOf(state)
  const away = state.players.filter((player) => player.id !== state.you && !player.connected)

  return (
    <section className="game online-game" aria-label="Online spel">
      <div className="players players-row">
        {state.players.map((player) =>
          player.shape === undefined ? null : (
            <div key={player.id} className="player" data-you={player.id === state.you || undefined}>
              <ShapeIcon shape={player.shape} size={28} decorative />
              <span>
                {displayName(state, player.shape)}
                {player.id === state.you && ' (jij)'}
              </span>
            </div>
          ),
        )}
      </div>

      {away.length > 0 && (
        <p className="message" role="status">
          {away.map((player) => displayName(state, player.shape ?? '')).join(' en ')} is even weg…
          Het spel wacht op terugkomst.
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
        <span>{statusText(state, game)}</span>
      </p>

      <p className="field-label">{fieldLabel(state.field)}</p>

      <Board
        game={game}
        interactive={myTurn}
        onPlay={(cell) => {
          send({ type: 'move', x: cell.x, y: cell.y })
        }}
      />

      {canUndo && (
        <div className="game-actions">
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              send({ type: 'undo' })
            }}
          >
            Zet ongedaan maken
          </button>
        </div>
      )}

      {game.status.kind !== 'playing' && (
        <div className="game-actions">
          <button
            type="button"
            className="rematch"
            onClick={() => {
              send({ type: 'rematch' })
            }}
          >
            Nog een keer
          </button>
          <button
            type="button"
            className="rematch rematch-quiet"
            onClick={() => {
              setReplayRound(state.round)
            }}
          >
            Kijk terug
          </button>
        </div>
      )}
    </section>
  )
}
