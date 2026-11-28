import { forwardRef } from 'react'
import { RANK_SYMBOLS, RANKS, slips } from '../../shared/game/index.ts'
import type { GameSummary, PlayerSummary, Rank } from '../../shared/game/index.ts'
import { useText } from '../i18n/store.ts'
import { shapeOf } from '../play/players.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'

interface SummaryProps {
  summary: GameSummary
  /** What to call a player: the name they typed with their shape, or just the shape. */
  who: (player: string) => string
  /** Takes the replay to the move after `step` moves. */
  onJump: (step: number) => void
  /** The moves of the game in order, to know who made the best move and the biggest mistake. */
  rankOf: (index: number) => Rank | null
}

/** The badge of a rank: its symbol, and always the word next to it. */
export function RankBadge({ rank }: { rank: Rank }) {
  return (
    <span className="rank-badge" data-rank={rank} aria-hidden="true">
      {RANK_SYMBOLS[rank]}
    </span>
  )
}

/**
 * What the ranks of a game add up to, for each player: the moves of each rank, how many moves kept
 * what the position was worth (and how many that is based on), the best move and the biggest
 * mistake, which jump the replay to them, and one friendly sentence. For a game that was only
 * judged on what is clear, it says so and gives no accuracy.
 */
export const Summary = forwardRef<HTMLHeadingElement, SummaryProps>(function Summary(
  { summary, who, onJump, rankOf },
  heading,
) {
  const t = useText()
  const moreThanTwo = summary.players.length > 2
  return (
    <section className="summary" aria-labelledby="summary-title">
      <h3 id="summary-title" ref={heading} tabIndex={-1}>
        {t('summary.title')}
      </h3>
      {summary.certainty === 'tactical' && (
        <p className="summary-note">
          {t('summary.tactical')}
          {moreThanTwo && ` ${t('summary.tacticalPlayers')}`}
        </p>
      )}
      {summary.players.map((player) => (
        <PlayerBlock
          key={player.player}
          player={player}
          name={who(player.player)}
          onJump={onJump}
          rankOf={rankOf}
        />
      ))}
    </section>
  )
})

function PlayerBlock({
  player,
  name,
  onJump,
  rankOf,
}: {
  player: PlayerSummary
  name: string
  onJump: (step: number) => void
  rankOf: (index: number) => Rank | null
}) {
  const t = useText()
  const wrong = slips(player)
  const best = pick(player.best, rankOf)
  const worst = pick(player.worst, rankOf)
  return (
    <article className="summary-player" aria-label={name}>
      <h4 className="summary-name">
        <ShapeIcon shape={shapeOf(player.player)} size={28} decorative />
        <span>{t('summary.player', { name, count: player.moves })}</span>
      </h4>
      <p>
        {wrong === 0 ? t('summary.flawless', { name }) : t('summary.slips', { name, count: wrong })}
      </p>
      <ul className="summary-counts" aria-label={t('summary.counts')}>
        {RANKS.map((rank) => (
          <li key={rank}>
            <RankBadge rank={rank} />
            <span>
              {t(`rank.${rank}`)}: {player.counts[rank]}
            </span>
          </li>
        ))}
      </ul>
      {player.accuracy !== null && (
        <p>
          <strong>{t('summary.accuracy', { percent: Math.round(player.accuracy * 100) })}</strong>
          <br />
          <span className="summary-note">
            {t('summary.accuracyHelp', { count: player.judged })}
          </span>
        </p>
      )}
      <div className="summary-jumps">
        {best && (
          <button
            type="button"
            onClick={() => {
              onJump(best.step)
            }}
          >
            {t('summary.best', {
              step: best.step,
              symbol: RANK_SYMBOLS[best.rank],
              rank: t(`rank.${best.rank}`),
            })}
          </button>
        )}
        {worst && (
          <button
            type="button"
            onClick={() => {
              onJump(worst.step)
            }}
          >
            {t('summary.worst', {
              step: worst.step,
              symbol: RANK_SYMBOLS[worst.rank],
              rank: t(`rank.${worst.rank}`),
            })}
          </button>
        )}
      </div>
    </article>
  )
}

/** The move that was found (its place in the game, from 0) as the step to jump to, with its rank. */
function pick(
  index: number | null,
  rankOf: (index: number) => Rank | null,
): { step: number; rank: Rank } | null {
  if (index === null) return null
  const rank = rankOf(index)
  return rank === null ? null : { step: index + 1, rank }
}
