import { useEffect, useState } from 'react'
import type { GameSummary } from '../../shared/protocol.ts'
import { getToken } from '../online/identity.ts'
import { Link } from '../online/Link.tsx'
import { gamePath } from '../online/route.ts'
import { labelOf, shapeOf } from '../play/players.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { gamesApi } from './api.ts'
import type { GamesApi } from './api.ts'
import '../online/Online.css'
import './Games.css'

interface GamesPageProps {
  api?: GamesApi
}

const WHEN = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })

/** "Gespeelde spellen": the finished games of this browser, newest first, a page at a time. */
export function GamesPage({ api = gamesApi }: GamesPageProps) {
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
      <h2>Gespeelde spellen</h2>

      {status === 'loading' && <p role="status">Spellen ophalen…</p>}

      {status === 'failed' && (
        <>
          <p className="message" role="alert">
            De spellen zijn nu niet op te halen. Probeer het zo nog eens.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setStatus('loading')
              setAttempt((count) => count + 1)
            }}
          >
            Opnieuw proberen
          </button>
        </>
      )}

      {status === 'ready' && games.length === 0 && (
        <>
          <p>Je hebt op dit apparaat nog geen spel online gespeeld.</p>
          <p>
            Een spel dat uit is, staat hier vanzelf. Spellen die je samen op één scherm speelt
            worden niet bewaard.
          </p>
        </>
      )}

      {games.length > 0 && (
        <>
          <p>Dit zijn de spellen die je op dit apparaat hebt gespeeld, de nieuwste eerst.</p>
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
          {loadingMore ? 'Laden…' : 'Meer spellen'}
        </button>
      )}
      {moreFailed && (
        <p className="message" role="alert">
          De volgende spellen zijn nu niet op te halen. Probeer het zo nog eens.
        </p>
      )}
    </div>
  )
}

function GameItem({ game }: { game: GameSummary }) {
  const nameOfPlayer = (id: string) => labelOf(id, game.players.find((p) => p.id === id)?.name)
  const result =
    game.result.kind === 'won' ? `${nameOfPlayer(game.result.winner)} heeft gewonnen` : 'Gelijkspel'
  return (
    <Link to={gamePath(game.id)} className="game-item">
      <span className="game-when">
        {WHEN.format(game.finishedAt)}
        {(game.width !== 3 || game.height !== 3) &&
          ` · veld van ${game.width.toString()} bij ${game.height.toString()}`}
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
