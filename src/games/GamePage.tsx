import { useEffect, useState } from 'react'
import type { StoredGame } from '../../shared/protocol.ts'
import { CopyLink } from '../online/CopyLink.tsx'
import { roomApi } from '../online/api.ts'
import type { RoomApi } from '../online/api.ts'
import { Link } from '../online/Link.tsx'
import { gamePath, navigate, roomPath } from '../online/route.ts'
import { Replay } from '../replay/Replay.tsx'
import { gamesApi } from './api.ts'
import type { GamesApi } from './api.ts'
import '../online/Online.css'
import './Games.css'

interface GamePageProps {
  id: string
  api?: GamesApi
  rooms?: RoomApi
}

const WHEN = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short' })

type Loaded = { status: 'loading' | 'missing' | 'failed' } | { status: 'ready'; game: StoredGame }

/** A finished game at its own address: anyone who has the link can watch it, move by move. */
export function GamePage({ id, api = gamesApi, rooms = roomApi }: GamePageProps) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [again, setAgain] = useState<'idle' | 'busy' | 'failed'>('idle')

  useEffect(() => {
    let current = true
    api.getGame(id).then(
      (game) => {
        if (current) setLoaded(game ? { status: 'ready', game } : { status: 'missing' })
      },
      () => {
        if (current) setLoaded({ status: 'failed' })
      },
    )
    return () => {
      current = false
    }
  }, [api, id, attempt])

  // A new room for a new game. Every game is still the classic one, so the same players and the
  // same field is simply another room; a field and shapes of their own come with the big field.
  async function playAgain() {
    setAgain('busy')
    try {
      navigate(roomPath(await rooms.createRoom()))
    } catch {
      setAgain('failed')
    }
  }

  return (
    <div className="game-page">
      {loaded.status === 'loading' && <p role="status">Spel ophalen…</p>}

      {loaded.status === 'missing' && (
        <p className="message" role="alert">
          Dit spel bestaat niet (meer), of de link klopt niet. Vraag de link nog eens aan degene die
          hem deelde.
        </p>
      )}

      {loaded.status === 'failed' && (
        <>
          <p className="message" role="alert">
            Het spel is nu niet op te halen. Probeer het zo nog eens.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setLoaded({ status: 'loading' })
              setAttempt((count) => count + 1)
            }}
          >
            Opnieuw proberen
          </button>
        </>
      )}

      {loaded.status === 'ready' && (
        <>
          <h2>Spel van {WHEN.format(loaded.game.finishedAt)}</h2>
          <Replay
            config={loaded.game.config}
            moves={loaded.game.moves}
            players={loaded.game.players}
          />
          <button
            type="button"
            className="button button-primary"
            disabled={again === 'busy'}
            onClick={() => {
              void playAgain()
            }}
          >
            Speel opnieuw
          </button>
          {again === 'failed' && (
            <p className="message" role="alert">
              Het maken van een kamer lukt nu niet. Probeer het zo nog eens.
            </p>
          )}
          <CopyLink
            link={`${window.location.origin}${gamePath(loaded.game.id)}`}
            lead="Laat dit spel aan iemand anders zien met deze link:"
          />
        </>
      )}

      <div className="actions">
        <Link to="/spellen" className="button">
          Alle gespeelde spellen
        </Link>
        <Link to="/" className="button button-quiet">
          Terug naar het begin
        </Link>
      </div>
    </div>
  )
}
