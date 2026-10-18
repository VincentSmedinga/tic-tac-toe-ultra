import type { CSSProperties } from 'react'
import { useText } from '../i18n/store.ts'
import { cellName } from './format.ts'

export interface Bar {
  /** What the bar is called, for screen readers and under the bar. */
  label: string
  value: number
  /** The text for screen readers, when "label: value" isn't enough. */
  description?: string
}

interface BarsProps {
  /** What the chart shows, said once; the figure is named by it. */
  title: string
  bars: readonly Bar[]
  /** Print the number above each bar; leave it for charts with too many bars. */
  showValues?: boolean
  /** Print the label under every n-th bar (the first, and then each n-th). */
  labelEvery?: number
}

/**
 * Bars drawn with CSS from the tokens. Every bar is also a list item that says its number, so the
 * chart is never only a picture, and none of it depends on colour: the height and the numbers do.
 */
export function Bars({ title, bars, showValues = true, labelEvery = 1 }: BarsProps) {
  const most = Math.max(1, ...bars.map(({ value }) => value))
  return (
    <figure className="stats-bars" aria-label={title}>
      <ul style={{ '--bars': bars.length } as CSSProperties}>
        {bars.map(({ label, value, description }, index) => (
          <li key={`${label}-${index.toString()}`}>
            <span className="stats-bar-value" aria-hidden="true">
              {showValues ? value : ''}
            </span>
            <span className="stats-bar-track" aria-hidden="true">
              <span
                className="stats-bar"
                style={{ height: `${((value / most) * 100).toString()}%` }}
              />
            </span>
            <span className="stats-bar-label" aria-hidden="true">
              {index % labelEvery === 0 ? label : ''}
            </span>
            <span className="stats-sr">{description ?? `${label}: ${value.toString()}`}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

interface HeatMapProps {
  title: string
  width: number
  height: number
  /** A count for each cell, row by row. */
  counts: readonly number[]
  /** What is counted, which the note under the picture says in words. */
  kind: 'first' | 'winning'
}

/** The cells with the most counts, most first, at most `limit` of them. */
function top(counts: readonly number[], width: number, limit: number) {
  return counts
    .map((count, index) => ({ count, x: index % width, y: Math.floor(index / width) }))
    .filter(({ count }) => count > 0)
    .sort((a, b) => b.count - a.count || a.y - b.y || a.x - b.x)
    .slice(0, limit)
}

/**
 * A small picture of a field in which the cells that were counted most are the darkest, with the
 * cells that count most said in words under it, so that the numbers are text and not only shading.
 */
export function HeatMap({ title, width, height, counts, kind }: HeatMapProps) {
  const t = useText()
  const most = Math.max(1, ...counts)
  const best = top(counts, width, 3)
  const said = best
    .map(({ x, y, count }) => t('stats.heat.cell', { cell: cellName(t, x, y), count }))
    .join('; ')
  return (
    <figure className="stats-heat">
      <figcaption>{title}</figcaption>
      <svg
        role="img"
        aria-label={
          said === ''
            ? t('stats.heat.ariaNothing', { title })
            : t('stats.heat.aria', { title, cells: said })
        }
        viewBox={`0 0 ${(width * 10).toString()} ${(height * 10).toString()}`}
        style={{ '--columns': width } as CSSProperties}
      >
        {counts.map((count, index) => (
          <rect
            key={index}
            x={(index % width) * 10}
            y={Math.floor(index / width) * 10}
            width={10}
            height={10}
            className="stats-heat-cell"
            style={{ fillOpacity: count / most }}
          />
        ))}
      </svg>
      <p className="stats-note">
        {said === ''
          ? t('stats.heat.nothing')
          : t(kind === 'first' ? 'stats.heat.firstNote' : 'stats.heat.winningNote', {
              cells: said,
            })}
      </p>
    </figure>
  )
}
