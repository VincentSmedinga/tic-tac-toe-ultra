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
  // Which choice a message is about, so that it shows in that choice and not somewhere else.
  const [message, setMessage] = useState<{ card: 'create' | 'join'; text: string } | null>(
    notice === 'bad-code'
      ? {
          card: 'join',
          text: 'Dat is geen geldige code. Vraag de code opnieuw aan je tegenspeler.',
        }
      : null,
  )
  const [busy, setBusy] = useState(false)

  async function createRoom() {
    setBusy(true)
    setMessage(null)
    setName(name)
    try {
      navigate(roomPath(await api.createRoom()))
    } catch {
      setMessage({
        card: 'create',
        text: 'Het maken van een kamer lukt nu niet. Probeer het zo nog eens.',
      })
      setBusy(false)
    }
  }

  async function join(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!roomCodeSchema.safeParse(code).success) {
      setMessage({
        card: 'join',
        text: `Een code heeft ${ROOM_CODE_LENGTH.toString()} letters, zonder klinkers.`,
      })
      return
    }
    setBusy(true)
    setMessage(null)
    setName(name)
    try {
      if (await api.roomExists(code)) {
        navigate(roomPath(code))
        return
      }
      setMessage({ card: 'join', text: 'Die kamer bestaat niet. Controleer de code.' })
    } catch {
      setMessage({
        card: 'join',
        text: 'Het zoeken naar de kamer lukt nu niet. Probeer het zo nog eens.',
      })
    }
    setBusy(false)
  }

  const alert = (card: 'create' | 'join') =>
    message?.card === card && (
      <p className="message" role="alert">
        {message.text}
      </p>
    )

  return (
    <div className="start">
      <section className="choice choice-name" aria-labelledby="who-title">
        <h2 id="who-title">Wie ben je?</h2>
        <div className="field">
          <label htmlFor="player-name">Je naam (hoeft niet)</label>
          <input
            id="player-name"
            name="given-name"
            type="text"
            // "given-name" is what makes Safari offer the name from the Contacts app.
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => {
              setNameState(event.target.value)
            }}
          />
        </div>
      </section>

      <p className="start-lead">Kies hoe je wilt spelen:</p>

      <section className="choice choice-primary" aria-labelledby="create-title">
        <h2 id="create-title">Een nieuwe kamer starten</h2>
        <p>
          Je krijgt een code die je aan je tegenspeler geeft. Jullie spelen elk op je eigen
          apparaat.
        </p>
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
        {alert('create')}
      </section>

      <section className="choice" aria-labelledby="join-title">
        <h2 id="join-title">Meedoen met een code</h2>
        <p>Heeft iemand een kamer gemaakt? Vul de code van vier letters in.</p>
        <form className="join" onSubmit={(event) => void join(event)}>
          <div className="field">
            <label htmlFor="room-code">Code van de kamer</label>
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
        {alert('join')}
      </section>

      <section className="choice" aria-labelledby="local-title">
        <h2 id="local-title">Samen op één scherm</h2>
        <p>Twee spelers op dit apparaat, om de beurt.</p>
        <Link to="/samen" className="button">
          Samen spelen
        </Link>
      </section>

      <details>
        <summary>Alle vormen</summary>
        <ShapeGallery />
      </details>
    </div>
  )
}
