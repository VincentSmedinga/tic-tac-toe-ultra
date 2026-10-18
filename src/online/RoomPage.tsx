import { useState } from 'react'
import type { StateMessage } from '../../shared/protocol.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { nameOf, shapeOf } from '../play/players.ts'
import { getName, getToken, sanitizeName } from './identity.ts'
import { Link } from './Link.tsx'
import { OnlineGame } from './OnlineGame.tsx'
import { browserDeps, useRoom } from './useRoom.ts'
import type { RoomDeps, RoomProblem } from './useRoom.ts'
import './Online.css'

interface RoomPageProps {
  code: string
  deps?: RoomDeps
}

const PROBLEMS: Record<RoomProblem, string> = {
  'unknown-room': 'Deze kamer bestaat niet (meer). Controleer de code, of maak een nieuwe kamer.',
  'room-full': 'Deze kamer zit vol: er spelen al twee mensen.',
  replaced:
    'Je speelt al in een ander venster of tabblad. Ga daar verder, of probeer het hier opnieuw.',
  unreachable: 'De kamer is nu niet te bereiken. Controleer je verbinding en probeer het opnieuw.',
  'invalid-message': 'Er ging iets mis. Probeer het opnieuw.',
  'not-joined': 'Er ging iets mis. Probeer het opnieuw.',
  'waiting-for-opponent': 'Er ging iets mis. Probeer het opnieuw.',
  'room-damaged': 'Er ging iets mis. Probeer het opnieuw.',
  'game-over': 'Er ging iets mis. Probeer het opnieuw.',
  'game-not-over': 'Er ging iets mis. Probeer het opnieuw.',
  'not-your-turn': 'Er ging iets mis. Probeer het opnieuw.',
  'out-of-bounds': 'Er ging iets mis. Probeer het opnieuw.',
  'cell-taken': 'Er ging iets mis. Probeer het opnieuw.',
}

/** A room: waiting for the other player, and then the two of you together. */
export function RoomPage({ code, deps = browserDeps }: RoomPageProps) {
  const [identity] = useState(() => ({ token: getToken(), name: sanitizeName(getName()) }))
  const { connection, state, problem, retry, send } = useRoom(code, identity, deps)

  // While a connection that was lost is tried again, the game stays on screen; only a problem
  // that trying again won't solve (or one before the room ever answered) takes the page.
  if (problem !== null && (state === null || problem !== 'unreachable')) {
    // Trying again only helps when the problem is the connection, not the room.
    const canRetry =
      problem === 'replaced' || problem === 'unreachable' || problem === 'invalid-message'
    return (
      <div className="room">
        <p className="message" role="alert">
          {PROBLEMS[problem]}
        </p>
        <div className="actions">
          {canRetry && (
            <button type="button" className="button button-primary" onClick={retry}>
              Opnieuw proberen
            </button>
          )}
          <Link to="/" className="button">
            Terug naar het begin
          </Link>
        </div>
      </div>
    )
  }

  if (state === null) {
    if (connection === 'closed') return <Lost onRetry={retry} />
    return (
      <p className="room" role="status">
        Verbinden met de kamer…
      </p>
    )
  }

  const together = state.players.length >= 2
  return (
    <div className="room">
      {connection !== 'open' && <Lost onRetry={retry} connecting={connection === 'connecting'} />}

      {together ? (
        <OnlineGame state={state} send={send} />
      ) : (
        <>
          <h2>Kamer</h2>
          <p className="room-code" aria-label={`Code ${state.code.split('').join(' ')}`}>
            {state.code}
          </p>
          <ShareLink code={state.code} />
          <Players state={state} />
          <p role="status">Wachten op een tweede speler…</p>
        </>
      )}

      <Link to="/" className="button button-quiet">
        Terug naar het begin
      </Link>
    </div>
  )
}

/** The connection is gone; it is tried again by itself, and a button does it now. */
function Lost({ onRetry, connecting = false }: { onRetry: () => void; connecting?: boolean }) {
  return (
    <div className="lost" role="alert">
      <p>
        {connecting
          ? 'Opnieuw verbinden…'
          : 'De verbinding is verbroken. Er wordt opnieuw geprobeerd.'}
      </p>
      <button type="button" className="button button-primary" onClick={onRetry}>
        Nu opnieuw verbinden
      </button>
    </div>
  )
}

/** Who has a seat: their shape, their name if they gave one, and which of them is you. */
function Players({ state }: { state: StateMessage }) {
  return (
    <div className="players">
      {state.players.map((player) => (
        <div key={player.id} className="player">
          <ShapeIcon shape={shapeOf(player.id)} size={32} decorative />
          <span>
            {player.name ?? nameOf(player.id)}
            {player.name !== undefined && ` (${nameOf(player.id).toLowerCase()})`}
            {player.id === state.you && ' – jij'}
            {!player.connected && ' – niet verbonden'}
          </span>
        </div>
      ))}
    </div>
  )
}

/** The address of the room, to copy and send to the other player. */
function ShareLink({ code }: { code: string }) {
  const link = `${window.location.origin}/kamer/${code}`
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <div className="share">
      <p>Geef deze code of deze link aan je tegenspeler:</p>
      <p className="share-link">{link}</p>
      <button
        type="button"
        className="button"
        onClick={() => {
          void copy()
        }}
      >
        Kopieer link
      </button>
      {copied === 'yes' && <p role="status">Link gekopieerd.</p>}
      {copied === 'no' && (
        <p role="status">Kopiëren lukt niet. Selecteer de link hierboven en kopieer hem zelf.</p>
      )}
    </div>
  )
}
