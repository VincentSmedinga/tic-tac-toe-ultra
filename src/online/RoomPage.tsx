import { useEffect, useState } from 'react'
import { useFormat } from '../i18n/format.ts'
import { useText } from '../i18n/store.ts'
import type { PlainKey } from '../i18n/types.ts'
import type { ClientMessage, StateMessage } from '../../shared/protocol.ts'
import type { ShapeId } from '../../shared/shapes.ts'
import { ShapePicker } from '../play/ShapePicker.tsx'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { useShapeNames } from '../shapes/names.ts'
import { fieldLabel } from '../play/field.ts'
import { usePlayerNames } from '../play/players.ts'
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
import { navigate, roomPath } from './route.ts'
import { useScrollToTop } from './scroll.ts'
import { isStarted } from './started.ts'
import { browserDeps, useRoom } from './useRoom.ts'
import type { RoomDeps, RoomProblem } from './useRoom.ts'
import './Online.css'

interface RoomPageProps {
  code: string
  deps?: RoomDeps
}

/**
 * What each code of the server (`ErrorCode`, plus the three the app has itself) is called to a
 * player. The server sends codes and no words, so this is the only place that turns them into text.
 */
const PROBLEMS: Record<Exclude<RoomProblem, 'you-left'>, PlainKey> = {
  'unknown-room': 'problem.unknownRoom',
  'room-full': 'problem.roomFull',
  'game-started': 'problem.gameStarted',
  left: 'problem.left',
  'room-over': 'problem.generic',
  'not-host': 'problem.notHost',
  'not-enough-players': 'problem.notEnoughPlayers',
  replaced: 'problem.replaced',
  unreachable: 'problem.unreachable',
  'invalid-message': 'problem.generic',
  'not-joined': 'problem.generic',
  'waiting-for-opponent': 'problem.generic',
  'room-damaged': 'problem.generic',
  'shape-needed': 'problem.shapeNeeded',
  'shape-taken': 'problem.shapeTaken',
  'shape-locked': 'problem.shapeLocked',
  'game-over': 'problem.generic',
  'game-not-over': 'problem.generic',
  'not-your-turn': 'problem.generic',
  'out-of-bounds': 'problem.generic',
  'cell-taken': 'problem.generic',
}

/** A room: waiting for the other player, and then the two of you together. */
export function RoomPage({ code, deps = browserDeps }: RoomPageProps) {
  const t = useText()
  const [identity] = useState(() => ({
    token: getToken(),
    name: sanitizeName(getName()),
    shape: getShape(),
  }))
  const { connection, state, problem, retry, send } = useRoom(code, identity, deps)

  // Remember the room once there is a seat in it, so that the start screen can lead back to it;
  // forget it when it is gone or full, or when this player has left it, since going back would
  // only show that.
  const seated = state !== null
  useEffect(() => {
    if (problem === 'you-left') clearLastRoom()
    else if (seated) setLastRoom(code)
    else if (
      problem === 'unknown-room' ||
      problem === 'room-full' ||
      problem === 'game-started' ||
      problem === 'left'
    )
      clearLastRoom()
  }, [seated, problem, code])

  // The room has let this player go: back to the start.
  useEffect(() => {
    if (problem === 'you-left') navigate('/')
  }, [problem])

  // Remember the shape this browser plays with, so that the next room asks for it again.
  const myShape = state?.players.find((player) => player.id === state.you)?.shape
  useEffect(() => {
    if (myShape) setShape(myShape)
  }, [myShape])

  if (problem === 'you-left') return null

  // While a connection that was lost is tried again, the game stays on screen; only a problem
  // that trying again won't solve (or one before the room ever answered) takes the page.
  if (problem !== null && (state === null || problem !== 'unreachable')) {
    // Trying again only helps when the problem is the connection, not the room.
    const canRetry =
      problem === 'replaced' || problem === 'unreachable' || problem === 'invalid-message'
    return (
      <div className="room">
        <p className="message" role="alert">
          {t(PROBLEMS[problem])}
        </p>
        <div className="actions">
          {canRetry && (
            <button type="button" className="button button-primary" onClick={retry}>
              {t('common.retry')}
            </button>
          )}
          <Link to="/" className="button">
            {t('nav.back')}
          </Link>
        </div>
      </div>
    )
  }

  if (state === null) {
    if (connection === 'closed') return <Lost onRetry={retry} />
    return (
      <p className="room" role="status">
        {t('room.connecting')}
      </p>
    )
  }

  const lostBanner =
    connection !== 'open' ? <Lost onRetry={retry} connecting={connection === 'connecting'} /> : null

  return (
    <div className="room">
      {isStarted(state) ? (
        // The game takes the banner in with it, so that it shows over the whole screen too.
        <OnlineGame
          state={state}
          send={send}
          banner={lostBanner}
          connected={connection === 'open'}
        />
      ) : (
        <>
          {lostBanner}
          <Lobby state={state} send={send} />
        </>
      )}
    </div>
  )
}

/** The room before the game: the code, who is here, and everybody choosing their shape. */
function Lobby({ state, send }: { state: StateMessage; send: (message: ClientMessage) => void }) {
  const t = useText()
  useScrollToTop('lobby')
  const { list } = useFormat()
  const mine = state.players.find((player) => player.id === state.you)
  const host = state.players[0]
  const isHost = host?.id === state.you
  const free = state.seats - state.players.length
  const everyoneChose = state.players.every((player) => player.shape !== undefined)
  const stillChoosing = state.players.filter((player) => player.shape === undefined)

  // The shapes the others have, so that those can't be picked: with whose they are.
  const taken: Partial<Record<ShapeId, string>> = {}
  for (const player of state.players) {
    if (player.id !== state.you && player.shape)
      taken[player.shape] = player.name ?? t('player.someone')
  }

  let status = t('room.status.waitSecond')
  if (state.players.length >= 2) {
    if (mine?.shape === undefined) status = t('room.status.pickShape')
    else if (!everyoneChose)
      status = t('room.status.choosing', {
        names: list(stillChoosing.map((player) => player.name ?? t('player.somePlayer'))),
        count: stillChoosing.length,
      })
    else if (free > 0 && isHost) status = t('room.status.startNow', { count: free })
    else if (free > 0)
      status =
        host?.name === undefined
          ? t('room.status.waitFirst')
          : t('room.status.waitHost', { name: host.name })
  } else if (state.seats > 2) {
    status = t('room.status.waitMore')
  }

  return (
    <>
      <h2>{t('room.title')}</h2>
      <p
        className="room-code"
        aria-label={t('room.code', { letters: state.code.split('').join(' ') })}
      >
        {state.code}
      </p>
      <p className="field-label">
        {state.seats > 2
          ? t('room.fieldSeats', { field: fieldLabel(t, state.field), seats: state.seats })
          : t('room.field', { field: fieldLabel(t, state.field) })}
      </p>
      {free > 0 && <ShareLink code={state.code} several={state.seats > 2} />}
      <Players state={state} />
      <ShapePicker
        label={t('room.pickShape')}
        value={mine?.shape ?? null}
        taken={taken}
        onChange={(shape) => {
          send({ type: 'choose', shape })
        }}
      />
      <p role="status">{status}</p>
      {isHost && free > 0 && state.players.length >= 2 && (
        <button
          type="button"
          className="button button-primary"
          disabled={!everyoneChose}
          onClick={() => {
            send({ type: 'start' })
          }}
        >
          {t('room.start', { count: state.players.length })}
        </button>
      )}
    </>
  )
}

/** The connection is gone; it is tried again by itself, and a button does it now. */
function Lost({ onRetry, connecting = false }: { onRetry: () => void; connecting?: boolean }) {
  const t = useText()
  return (
    <div className="lost" role="alert">
      <p>{connecting ? t('room.lost.connecting') : t('room.lost.broken')}</p>
      <button type="button" className="button button-primary" onClick={onRetry}>
        {t('room.lost.retry')}
      </button>
    </div>
  )
}

/** Who has a seat: their shape (once chosen), their name if they gave one, and which one is you. */
function Players({ state }: { state: StateMessage }) {
  const t = useText()
  const { nameOf } = usePlayerNames()
  const shapeNames = useShapeNames()
  return (
    <div className="players">
      {state.players.map((player) => {
        const { shape } = player
        const label =
          shape === undefined
            ? (player.name ?? t('player.anonymous'))
            : player.name === undefined
              ? nameOf(shape)
              : t('player.withShape', { name: player.name, shape: shapeNames.name(shape) })
        // What else there is to say about this player, in a row: the dash is punctuation, every
        // word of it comes from the dictionary.
        const notes = [
          player.id === state.you && t('player.you'),
          shape === undefined && t('player.choosing'),
          !player.connected && t('player.disconnected'),
        ].filter(Boolean)
        return (
          <div key={player.id} className="player">
            {shape ? (
              <ShapeIcon shape={shape} size={32} decorative />
            ) : (
              <span className="shape-blank" aria-hidden="true" />
            )}
            <span>{[label, ...notes].join(' – ')}</span>
          </div>
        )
      })}
      {Array.from({ length: Math.max(0, state.seats - state.players.length) }, (_, index) => (
        <div
          key={`free-${(index + state.players.length).toString()}`}
          className="player player-free"
        >
          <span className="shape-blank" aria-hidden="true" />
          <span>{t('room.freeSeat', { number: state.players.length + index + 1 })}</span>
        </div>
      ))}
    </div>
  )
}

function ShareLink({ code, several }: { code: string; several: boolean }) {
  const t = useText()
  return (
    <CopyLink
      link={`${window.location.origin}${roomPath(code)}`}
      lead={t(several ? 'room.share.others' : 'room.share.opponent')}
    />
  )
}
