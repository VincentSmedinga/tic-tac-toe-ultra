import { useState } from 'react'
import type { SyntheticEvent } from 'react'
import { MAX_NAME_LENGTH, roomCodeSchema } from '../../shared/protocol.ts'
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../shared/room.ts'
import { ShapeGallery } from '../shapes/ShapeGallery.tsx'
import type { RoomApi } from './api.ts'
import { roomApi } from './api.ts'
import { getName, setName } from './identity.ts'
import { Link } from './Link.tsx'
import { navigate, roomPath } from './route.ts'
import './Online.css'

interface StartScreenProps {
  /** Set when the address of a room was no code. */
  notice?: 'bad-code'
  api?: RoomApi
}

/** Only the letters a room code has, in capitals, and no more than a code is long. */
function cleanCode(text: string): string {
  const letters = new RegExp(`[^${ROOM_CODE_ALPHABET}]`, 'g')
  return text.toUpperCase().replace(letters, '').slice(0, ROOM_CODE_LENGTH)
}

/** Where you start: a new room, a room of someone else, or the game on one screen. */
export function StartScreen({ notice, api = roomApi }: StartScreenProps) {
  const [name, setNameState] = useState(getName)
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(
    notice === 'bad-code'
      ? 'Dat is geen geldige code. Vraag de code opnieuw aan je tegenspeler.'
      : null,
  )
  const [busy, setBusy] = useState(false)

  async function createRoom() {
    setBusy(true)
    setMessage(null)
    setName(name.trim())
    try {
      navigate(roomPath(await api.createRoom()))
    } catch {
      setMessage('Het maken van een kamer lukt nu niet. Probeer het zo nog eens.')
      setBusy(false)
    }
  }

  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roomCodeSchema.safeParse(code).success) {
      setMessage(`Een code heeft ${ROOM_CODE_LENGTH.toString()} letters, zonder klinkers.`)
      return
    }
    setBusy(true)
    setMessage(null)
    setName(name.trim())
    try {
      if (await api.roomExists(code)) {
        navigate(roomPath(code))
        return
      }
      setMessage('Die kamer bestaat niet. Controleer de code.')
    } catch {
      setMessage('Het zoeken naar de kamer lukt nu niet. Probeer het zo nog eens.')
    }
    setBusy(false)
  }

  return (
    <div className="start">
      <div className="field">
        <label htmlFor="player-name">Je naam (hoeft niet)</label>
        <input
          id="player-name"
          type="text"
          autoComplete="nickname"
          maxLength={MAX_NAME_LENGTH}
          value={name}
          onChange={(event) => {
            setNameState(event.target.value)
          }}
        />
      </div>

      <button
        type="button"
        className="button button-primary"
        disabled={busy}
        onClick={() => {
          void createRoom()
        }}
      >
        Nieuwe kamer
      </button>

      <form className="join" onSubmit={(event) => void join(event)}>
        <div className="field">
          <label htmlFor="room-code">Meedoen met een code</label>
          <input
            id="room-code"
            className="code-input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={ROOM_CODE_LENGTH}
            placeholder="BCDF"
            value={code}
            onChange={(event) => {
              setCode(cleanCode(event.target.value))
            }}
          />
        </div>
        <button type="submit" className="button" disabled={busy}>
          Meedoen
        </button>
      </form>

      {message !== null && (
        <p className="message" role="alert">
          {message}
        </p>
      )}

      <Link to="/samen" className="button button-quiet">
        Samen op één scherm
      </Link>

      <details>
        <summary>Alle vormen</summary>
        <ShapeGallery />
      </details>
    </div>
  )
}
