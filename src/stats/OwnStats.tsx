import { useEffect, useState } from 'react'
import type { OwnStats as Own } from '../../shared/protocol.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { statsApi } from './api.ts'
import type { OwnStatsApi } from './api.ts'
import { games, shapeName } from './format.ts'
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
  const known = stats.games - stats.unknown
  return (
    <section className="own-stats" aria-label="Jouw statistieken">
      <p>
        Je hebt {games(stats.games)} gespeeld
        {known > 0 &&
          `: ${stats.won.toString()} gewonnen, ${stats.lost.toString()} verloren en ${stats.drawn.toString()} gelijk`}
        .
      </p>
      {stats.favourite && (
        <p className="own-stats-favourite">
          <ShapeIcon shape={stats.favourite.shape} size={24} decorative />
          <span>
            Je speelt het vaakst met het {shapeName(stats.favourite.shape).toLowerCase()} (
            {games(stats.favourite.games)}).
          </span>
        </p>
      )}
      {stats.unknown > 0 && known > 0 && (
        <p className="stats-note">
          Van {games(stats.unknown)} is niet meer bekend of je won; die tellen alleen mee als
          gespeeld.
        </p>
      )}
    </section>
  )
}
