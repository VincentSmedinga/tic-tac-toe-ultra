import { useState } from 'react'
import { replayGame } from '../../shared/game/index.ts'
import type { GameState } from '../../shared/game/index.ts'
import type { ClientMessage, StateMessage } from '../../shared/protocol.ts'
import { Board } from '../play/Board.tsx'
import { nameOf, shapeOf } from '../play/players.ts'
import { Replay } from '../replay/Replay.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import '../play/Game.css'
import './Online.css'

interface OnlineGameProps {
  state: StateMessage
  send: (message: ClientMessage) => void
}

/** The name a player goes by: the one they typed, or their shape ("Kruis"). */
function displayName(state: StateMessage, id: string): string {
  return state.players.find((player) => player.id === id)?.name ?? nameOf(id)
}

/** What the status line says, from the point of view of the player who reads it. */
function statusText(state: StateMessage, game: GameState): string {
  const { status } = game
  if (status.kind === 'draw') return 'Gelijkspel! Niemand heeft gewonnen.'
  if (status.kind === 'won') {
    return status.winner === state.you
      ? 'Je hebt gewonnen!'
      : `${displayName(state, status.winner)} heeft gewonnen!`
  }
  const starts = game.moveCount === 0
  if (status.next === state.you) return starts ? 'Jij begint' : 'Jij bent aan de beurt'
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
        players={state.players}
        onClose={() => {
          setReplayRound(null)
        }}
      />
    )
  }
  const myTurn = game.status.kind === 'playing' && game.status.next === state.you
  const away = state.players.filter((player) => player.id !== state.you && !player.connected)

  return (
    <section className="game online-game" aria-label="Online spel">
      <div className="players players-row">
        {state.players.map((player) => (
          <div key={player.id} className="player" data-you={player.id === state.you || undefined}>
            <ShapeIcon shape={shapeOf(player.id)} size={28} decorative />
            <span>
              {displayName(state, player.id)}
              {player.id === state.you && ' (jij)'}
            </span>
          </div>
        ))}
      </div>

      {away.length > 0 && (
        <p className="message" role="status">
          {away.map((player) => displayName(state, player.id)).join(' en ')} is even weg… Het spel
          wacht op terugkomst.
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
