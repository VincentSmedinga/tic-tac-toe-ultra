import { useEffect, useState } from 'react'
import type { StoredGame } from '../../shared/protocol.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { useFormat } from '../i18n/format.ts'
import { useText } from '../i18n/store.ts'
import { CopyLink } from '../online/CopyLink.tsx'
import { roomApi } from '../online/api.ts'
import type { RoomApi } from '../online/api.ts'
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

type Loaded = { status: 'loading' | 'missing' | 'failed' } | { status: 'ready'; game: StoredGame }

/** A finished game at its own address: anyone who has the link can watch it, move by move. */
export function GamePage({ id, api = gamesApi, rooms = roomApi }: GamePageProps) {
  const t = useText()
  const { dateTime } = useFormat()
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

  // A new room for a new game, on the same field: the players choose their shapes again, which
  // they do in every room.
  async function playAgain(field: FieldSettings) {
    setAgain('busy')
    try {
      navigate(roomPath(await rooms.createRoom(field)))
    } catch {
      setAgain('failed')
    }
  }

  return (
    <div className="game-page">
      {loaded.status === 'loading' && <p role="status">{t('gamePage.loading')}</p>}

      {loaded.status === 'missing' && (
        <p className="message" role="alert">
          {t('gamePage.missing')}
        </p>
      )}

      {loaded.status === 'failed' && (
        <>
          <p className="message" role="alert">
            {t('gamePage.failed')}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setLoaded({ status: 'loading' })
              setAttempt((count) => count + 1)
            }}
          >
            {t('common.retry')}
          </button>
        </>
      )}

      {loaded.status === 'ready' && (
        <>
          <h2>{t('gamePage.title', { date: dateTime(loaded.game.finishedAt, 'long') })}</h2>
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
              const { width, height, winLength } = loaded.game.config
              void playAgain({ width, height, winLength })
            }}
          >
            {t('gamePage.again')}
          </button>
          {again === 'failed' && (
            <p className="message" role="alert">
              {t('common.createRoomFailed')}
            </p>
          )}
          <CopyLink
            link={`${window.location.origin}${gamePath(loaded.game.id)}`}
            lead={t('gamePage.share')}
          />
        </>
      )}
    </div>
  )
}
