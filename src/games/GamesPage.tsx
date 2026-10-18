import { useEffect, useState } from 'react'
import type { GameSummary } from '../../shared/protocol.ts'
import { useFormat } from '../i18n/format.ts'
import { useText } from '../i18n/store.ts'
import { getToken } from '../online/identity.ts'
import { Link } from '../online/Link.tsx'
import { gamePath } from '../online/route.ts'
import { usePlayerNames, shapeOf } from '../play/players.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { OwnStats } from '../stats/OwnStats.tsx'
import type { OwnStatsApi } from '../stats/api.ts'
import { gamesApi } from './api.ts'
import type { GamesApi } from './api.ts'
import '../online/Online.css'
import './Games.css'

interface GamesPageProps {
  api?: GamesApi
  /** Where "your statistics" come from, when it isn't the server. */
  ownStats?: OwnStatsApi
}

/** "Gespeelde spellen": the finished games of this browser, newest first, a page at a time. */
export function GamesPage({ api = gamesApi, ownStats }: GamesPageProps) {
  const t = useText()
  const [token] = useState(getToken)
  const [games, setGames] = useState<GameSummary[]>([])
  const [next, setNext] = useState<string | undefined>()
  // `failed` is about the first page, which leaves nothing to show; a later page that fails only
  // leaves its button, so what is on screen stays.
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    api.listGames(token).then(
      (page) => {
        if (!current) return
        setGames(page.games)
        setNext(page.next)
        setStatus('ready')
      },
      () => {
        if (current) setStatus('failed')
      },
    )
    return () => {
      current = false
    }
  }, [api, token, attempt])

  async function loadMore() {
    setLoadingMore(true)
    setMoreFailed(false)
    try {
      const page = await api.listGames(token, next)
      setGames((shown) => [...shown, ...page.games])
      setNext(page.next)
    } catch {
      setMoreFailed(true)
    }
    setLoadingMore(false)
  }

  return (
    <div className="games">
      <h2>{t('games.title')}</h2>

      {status === 'loading' && <p role="status">{t('games.loading')}</p>}

      {status === 'failed' && (
        <>
          <p className="message" role="alert">
            {t('games.failed')}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setStatus('loading')
              setAttempt((count) => count + 1)
            }}
          >
            {t('common.retry')}
          </button>
        </>
      )}

      {status === 'ready' && games.length === 0 && (
        <>
          <p>{t('games.empty')}</p>
          <p>{t('games.emptyHelp')}</p>
        </>
      )}

      {games.length > 0 && (
        <>
          <p>{t('games.intro')}</p>
          <OwnStats token={token} {...(ownStats ? { api: ownStats } : {})} />
          <ol className="game-list">
            {games.map((game) => (
              <li key={game.id}>
                <GameItem game={game} />
              </li>
            ))}
          </ol>
        </>
      )}

      {next !== undefined && (
        <button
          type="button"
          className="button"
          disabled={loadingMore}
          onClick={() => {
            void loadMore()
          }}
        >
          {loadingMore ? t('games.loadingMore') : t('games.more')}
        </button>
      )}
      {moreFailed && (
        <p className="message" role="alert">
          {t('games.moreFailed')}
        </p>
      )}
    </div>
  )
}

function GameItem({ game }: { game: GameSummary }) {
  const t = useText()
  const { dateTime } = useFormat()
  const { labelOf } = usePlayerNames()
  const nameOfPlayer = (id: string) => labelOf(id, game.players.find((p) => p.id === id)?.name)
  const result =
    game.result.kind === 'won'
      ? t('games.won', { name: nameOfPlayer(game.result.winner) })
      : t('games.draw')
  const when = dateTime(game.finishedAt, 'medium')
  return (
    <Link to={gamePath(game.id)} className="game-item">
      <span className="game-when">
        {game.width !== 3 || game.height !== 3
          ? t('games.whenField', { date: when, width: game.width, height: game.height })
          : when}
      </span>
      <span className="game-players">
        {game.players.map((player) => (
          <span key={player.id} className="game-player">
            <ShapeIcon shape={shapeOf(player.id)} size={28} decorative />
            {labelOf(player.id, player.name)}
          </span>
        ))}
      </span>
      <span className="game-result">
        {game.result.kind === 'won' && (
          <ShapeIcon shape={shapeOf(game.result.winner)} size={20} decorative />
        )}
        {result}
      </span>
    </Link>
  )
}
