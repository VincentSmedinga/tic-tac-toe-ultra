import { useEffect, useState } from 'react'
import type { OwnStats as Own } from '../../shared/protocol.ts'
import { useText } from '../i18n/store.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { useShapeNames } from '../shapes/names.ts'
import { statsApi } from './api.ts'
import type { OwnStatsApi } from './api.ts'
import './Stats.css'

interface OwnStatsProps {
  /** Who is asking: this browser's token. */
  token: string
  api?: OwnStatsApi
}

/**
 * A few lines about the games of this browser, above its list of games: how many, how they ended
 * and the shape it plays most. It is a small extra and never in the way: while it is fetched, when
 * it fails and when there are no games, nothing is shown.
 */
export function OwnStats({ token, api = statsApi }: OwnStatsProps) {
  const t = useText()
  const shapes = useShapeNames()
  const [stats, setStats] = useState<Own | null>(null)

  useEffect(() => {
    let current = true
    api.getOwnStats(token).then(
      (result) => {
        if (current) setStats(result)
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [api, token])

  if (stats === null || stats.games === 0) return null
  const games = (count: number) => t('count.games', { count })
  const known = stats.games - stats.unknown
  return (
    <section className="own-stats" aria-label={t('ownStats.label')}>
      <p>
        {known > 0
          ? t('ownStats.results', {
              games: games(stats.games),
              won: stats.won,
              lost: stats.lost,
              drawn: stats.drawn,
            })
          : t('ownStats.played', { games: games(stats.games) })}
      </p>
      {stats.favourite && (
        <p className="own-stats-favourite">
          <ShapeIcon shape={stats.favourite.shape} size={24} decorative />
          <span>
            {t('ownStats.favourite', {
              shape: shapes.name(stats.favourite.shape),
              games: games(stats.favourite.games),
            })}
          </span>
        </p>
      )}
      {stats.unknown > 0 && known > 0 && (
        <p className="stats-note">{t('ownStats.unknown', { games: games(stats.unknown) })}</p>
      )}
    </section>
  )
}
