import { useEffect, useState } from 'react'
import type { ClientMessage, StateMessage } from '../../shared/protocol.ts'
import type { ShapeId } from '../../shared/shapes.ts'
import { ShapePicker } from '../play/ShapePicker.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { fieldLabel } from '../play/field.ts'
import { nameOf } from '../play/players.ts'
import {
  clearLastRoom,
  getName,
  getShape,
  getToken,
  sanitizeName,
  setLastRoom,
  setShape,
} from './identity.ts'
import { CopyLink } from './CopyLink.tsx'
import { Link } from './Link.tsx'
import { OnlineGame } from './OnlineGame.tsx'
import { roomPath } from './route.ts'
import { isStarted } from './started.ts'
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
  'shape-needed': 'Kies eerst een vorm.',
  'shape-taken': 'Die vorm heeft de ander al. Kies een andere.',
  'shape-locked': 'Het spel is al begonnen: je vorm kun je nu niet meer veranderen.',
  'game-over': 'Er ging iets mis. Probeer het opnieuw.',
  'game-not-over': 'Er ging iets mis. Probeer het opnieuw.',
  'not-your-turn': 'Er ging iets mis. Probeer het opnieuw.',
  'out-of-bounds': 'Er ging iets mis. Probeer het opnieuw.',
  'cell-taken': 'Er ging iets mis. Probeer het opnieuw.',
}

/** A room: waiting for the other player, and then the two of you together. */
export function RoomPage({ code, deps = browserDeps }: RoomPageProps) {
  const [identity] = useState(() => ({
    token: getToken(),
    name: sanitizeName(getName()),
    shape: getShape(),
  }))
  const { connection, state, problem, retry, send } = useRoom(code, identity, deps)

  // Remember the room once there is a seat in it, so that the start screen can lead back to it;
  // forget it when it is gone or full, since going back would only show that.
  const seated = state !== null
  useEffect(() => {
    if (seated) setLastRoom(code)
    else if (problem === 'unknown-room' || problem === 'room-full') clearLastRoom()
  }, [seated, problem, code])

  // Remember the shape this browser plays with, so that the next room asks for it again.
  const myShape = state?.players.find((player) => player.id === state.you)?.shape
  useEffect(() => {
    if (myShape) setShape(myShape)
  }, [myShape])

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

  return (
    <div className="room">
      {connection !== 'open' && <Lost onRetry={retry} connecting={connection === 'connecting'} />}

      {isStarted(state) ? (
        <OnlineGame state={state} send={send} />
      ) : (
        <Lobby state={state} send={send} />
      )}
    </div>
  )
}

/** The room before the game: the code, who is here, and everybody choosing their shape. */
function Lobby({ state, send }: { state: StateMessage; send: (message: ClientMessage) => void }) {
  const together = state.players.length >= 2
  const mine = state.players.find((player) => player.id === state.you)
  const other = state.players.find((player) => player.id !== state.you)

  // The shapes the other player has, so that those can't be picked: with whose they are.
  const taken: Partial<Record<ShapeId, string>> = {}
  for (const player of state.players) {
    if (player.id !== state.you && player.shape) taken[player.shape] = player.name ?? 'de ander'
  }

  let status = 'Wachten op een tweede speler…'
  if (together && mine?.shape === undefined) status = 'Kies een vorm om te beginnen.'
  else if (together && other?.shape === undefined)
    status = `${other?.name ?? 'De ander'} kiest nog een vorm…`

  return (
    <>
      <h2>Kamer</h2>
      <p className="room-code" aria-label={`Code ${state.code.split('').join(' ')}`}>
        {state.code}
      </p>
      <p className="field-label">Veld: {fieldLabel(state.field)}</p>
      {!together && <ShareLink code={state.code} />}
      <Players state={state} />
      <ShapePicker
        label="Kies je vorm"
        value={mine?.shape ?? null}
        taken={taken}
        onChange={(shape) => {
          send({ type: 'choose', shape })
        }}
      />
      <p role="status">{status}</p>
    </>
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

/** Who has a seat: their shape (once chosen), their name if they gave one, and which one is you. */
function Players({ state }: { state: StateMessage }) {
  return (
    <div className="players">
      {state.players.map((player) => {
        const { shape } = player
        const label =
          shape === undefined
            ? (player.name ?? 'Nieuwe speler')
            : (player.name ?? nameOf(shape)) +
              (player.name === undefined ? '' : ` (${nameOf(shape).toLowerCase()})`)
        return (
          <div key={player.id} className="player">
            {shape ? (
              <ShapeIcon shape={shape} size={32} decorative />
            ) : (
              <span className="shape-blank" aria-hidden="true" />
            )}
            <span>
              {label}
              {player.id === state.you && ' – jij'}
              {shape === undefined && ' – kiest nog'}
              {!player.connected && ' – niet verbonden'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ShareLink({ code }: { code: string }) {
  return (
    <CopyLink
      link={`${window.location.origin}${roomPath(code)}`}
      lead="Geef deze code of deze link aan je tegenspeler:"
    />
  )
}
