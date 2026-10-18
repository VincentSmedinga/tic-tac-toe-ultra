import { useEffect, useState } from 'react'
import type { Stats } from '../../shared/protocol.ts'
import { useFormat } from '../i18n/format.ts'
import { formatNumber } from '../i18n/text.ts'
import { useText } from '../i18n/store.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { useShapeNames } from '../shapes/names.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { statsApi } from './api.ts'
import type { StatsApi } from './api.ts'
import { HeatMap, Bars } from './Charts.tsx'
import { duration } from './format.ts'
import '../online/Online.css'
import './Stats.css'

/** With fewer games than this the numbers say nothing yet: an average of two games is not one. */
export const MIN_GAMES = 3

interface StatsPageProps {
  api?: StatsApi
}

/** "Statistieken": what the family has played, worked out from every finished game. */
export function StatsPage({ api = statsApi }: StatsPageProps) {
  const t = useText()
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    api.getStats().then(
      (result) => {
        if (!current) return
        setStats(result)
        setFailed(false)
      },
      () => {
        if (current) setFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [api, attempt])

  return (
    <div className="stats">
      <h2>{t('stats.title')}</h2>

      {stats === null && !failed && <p role="status">{t('stats.loading')}</p>}

      {failed && (
        <>
          <p className="message" role="alert">
            {t('stats.failed')}
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setFailed(false)
              setAttempt((count) => count + 1)
            }}
          >
            {t('common.retry')}
          </button>
        </>
      )}

      {stats !== null && stats.games < MIN_GAMES && <TooFew count={stats.games} />}
      {stats !== null && stats.games >= MIN_GAMES && <Numbers stats={stats} />}
    </div>
  )
}

function TooFew({ count }: { count: number }) {
  const t = useText()
  return (
    <section className="stats-card" aria-labelledby="stats-few">
      <h3 id="stats-few">{t('stats.few.title')}</h3>
      <p>
        {count === 0 ? t('stats.few.none') : t('stats.few.some', { count })} {t('stats.few.advice')}
      </p>
    </section>
  )
}

function Numbers({ stats }: { stats: Stats }) {
  return (
    <>
      <Totals stats={stats} />
      <Lengths stats={stats} />
      <Shapes stats={stats} />
      <Starter stats={stats} />
      <Rooms stats={stats} />
      {stats.kinds.map((kind) => (
        <Kind
          key={`${kind.width.toString()}x${kind.height.toString()}x${kind.winLength.toString()}x${kind.players.toString()}`}
          kind={kind}
        />
      ))}
      <When stats={stats} />
      <Fun stats={stats} />
    </>
  )
}

function Totals({ stats }: { stats: Stats }) {
  const t = useText()
  const { shortDate } = useFormat()
  return (
    <section className="stats-card" aria-labelledby="stats-totals">
      <h3 id="stats-totals">{t('stats.totals.title')}</h3>
      <dl className="stats-figures">
        <div>
          <dt>{t('stats.totals.games')}</dt>
          <dd>{stats.games}</dd>
        </div>
        <div>
          <dt>{t('stats.totals.won')}</dt>
          <dd>{stats.won}</dd>
        </div>
        <div>
          <dt>{t('stats.totals.drawn')}</dt>
          <dd>{stats.drawn}</dd>
        </div>
      </dl>
      <h4>{t('stats.perWeek')}</h4>
      <Bars
        title={t('stats.perWeek.chart')}
        bars={stats.weeks.map(({ start, won, drawn }) => ({
          label: shortDate(start),
          value: won + drawn,
          description: t('stats.perWeek.bar', {
            date: shortDate(start),
            games: t('count.games', { count: won + drawn }),
          }),
        }))}
        labelEvery={4}
      />
    </section>
  )
}

function Lengths({ stats }: { stats: Stats }) {
  const t = useText()
  const { locale } = useFormat()
  const { duration: time, moves } = stats
  if (moves === null) return null
  return (
    <section className="stats-card" aria-labelledby="stats-lengths">
      <h3 id="stats-lengths">{t('stats.lengths.title')}</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="stats-sr">{t('stats.lengths.kind')}</span>
            </th>
            <th scope="col">{t('stats.lengths.time')}</th>
            <th scope="col">{t('stats.lengths.moves')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">{t('stats.lengths.average')}</th>
            <td>{time ? duration(t, time.average) : '–'}</td>
            <td>{formatNumber(locale, moves.average)}</td>
          </tr>
          <tr>
            <th scope="row">{t('stats.lengths.median')}</th>
            <td>{time ? duration(t, time.median) : '–'}</td>
            <td>{formatNumber(locale, moves.median)}</td>
          </tr>
          <tr>
            <th scope="row">{t('stats.lengths.shortest')}</th>
            <td>{time ? duration(t, time.shortest) : '–'}</td>
            <td>{moves.shortest}</td>
          </tr>
          <tr>
            <th scope="row">{t('stats.lengths.longest')}</th>
            <td>{time ? duration(t, time.longest) : '–'}</td>
            <td>{moves.longest}</td>
          </tr>
        </tbody>
      </table>
      <p className="stats-note">
        {time === null
          ? t('stats.lengths.noTime')
          : time.games === moves.games
            ? ''
            : t('stats.lengths.someTime', { games: t('count.games', { count: time.games }) })}
      </p>
    </section>
  )
}

function Shapes({ stats }: { stats: Stats }) {
  const t = useText()
  const { percent } = useFormat()
  const { title } = useShapeNames()
  const most = Math.max(1, ...stats.shapes.map(({ games: played }) => played))
  return (
    <section className="stats-card" aria-labelledby="stats-shapes">
      <h3 id="stats-shapes">{t('stats.shapes.title')}</h3>
      <ul className="stats-shapes">
        {stats.shapes.map(({ shape, games: played, won }) => (
          <li key={shape}>
            <ShapeIcon shape={shape} size={32} decorative />
            <span className="stats-shape-text">
              <strong>{title(shape)}</strong>
              <span className="stats-bar-line" aria-hidden="true">
                <span
                  className="stats-bar-fill"
                  style={{ width: `${((played / most) * 100).toString()}%` }}
                />
              </span>
              <span>
                {t('stats.shapes.line', {
                  games: t('count.games', { count: played }),
                  won,
                  percent: percent(won, played),
                })}
                {played < MIN_GAMES && (
                  <span className="stats-note"> · {t('stats.shapes.few')}</span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Starter({ stats }: { stats: Stats }) {
  const t = useText()
  const { percent } = useFormat()
  const { won, lost, drawn } = stats.starter
  const total = won + lost + drawn
  if (total === 0) return null
  return (
    <section className="stats-card" aria-labelledby="stats-starter">
      <h3 id="stats-starter">{t('stats.starter.title')}</h3>
      <p>{t('stats.starter.text', { won, total, percent: percent(won, total), lost, drawn })}</p>
      <StarterBar won={won} lost={lost} drawn={drawn} />
    </section>
  )
}

function Rooms({ stats }: { stats: Stats }) {
  const t = useText()
  const { percent } = useFormat()
  const { made, played, rematches, averageRounds, mostRounds, rounds } = stats.rooms
  if (made === 0) return null

  return (
    <section className="stats-card" aria-labelledby="stats-rooms">
      <h3 id="stats-rooms">{t('stats.rooms.title')}</h3>
      <p>
        {t('stats.rooms.made', { count: made })}
        {played > 0 &&
          ` ${t('stats.rooms.played', { played, rematches, percent: percent(rematches, played) })}`}
      </p>
      {played > 0 && (
        <>
          <p>{t('stats.rooms.average', { count: averageRounds, most: mostRounds })}</p>
          <h4>{t('stats.rooms.chart')}</h4>
          <Bars
            title={t('stats.rooms.chart')}
            bars={rounds.map((value, index) => ({
              label: index === 4 ? '5+' : (index + 1).toString(),
              value,
              description:
                index === 4
                  ? t('stats.rooms.barMany', {
                      rounds: 5,
                      rooms: t('count.rooms', { count: value }),
                    })
                  : t('stats.rooms.bar', {
                      count: index + 1,
                      rooms: t('count.rooms', { count: value }),
                    }),
            }))}
          />
        </>
      )}
    </section>
  )
}

function StarterBar({ won, lost, drawn }: { won: number; lost: number; drawn: number }) {
  const t = useText()
  const total = Math.max(1, won + lost + drawn)
  const parts = [
    { key: 'won', label: t('stats.starter.won'), count: won },
    { key: 'drawn', label: t('stats.starter.drawn'), count: drawn },
    { key: 'lost', label: t('stats.starter.lost'), count: lost },
  ]
  return (
    <div className="stats-split" aria-hidden="true">
      {parts.map(({ key, label, count }) => (
        <span
          key={key}
          className={`stats-split-part stats-split-${key}`}
          style={{ flexGrow: count / total, display: count === 0 ? 'none' : undefined }}
        >
          {label} {count}
        </span>
      ))}
    </div>
  )
}

function Kind({ kind }: { kind: Stats['kinds'][number] }) {
  const t = useText()
  const { width, height, winLength, players, games: played, won, drawn } = kind
  const enough = played >= MIN_GAMES
  return (
    <section className="stats-card" aria-labelledby={`stats-kind-${kindId(kind)}`}>
      <h3 id={`stats-kind-${kindId(kind)}`}>
        {t('stats.kind.title', { width, height, row: winLength })}
      </h3>
      <p>
        {t('stats.kind.summary', {
          players,
          games: t('count.games', { count: played }),
          won,
          drawn,
          moves: kind.averageMoves,
        })}
      </p>
      {enough ? (
        <>
          <p>
            {t('stats.kind.starter', {
              won: kind.starter.won,
              lost: kind.starter.lost,
              drawn: kind.starter.drawn,
            })}
          </p>
          <div className="stats-heats">
            <HeatMap
              title={t('stats.heat.first')}
              width={width}
              height={height}
              counts={kind.firstMoves}
              kind="first"
            />
            <HeatMap
              title={t('stats.heat.winning')}
              width={width}
              height={height}
              counts={kind.winningCells}
              kind="winning"
            />
          </div>
        </>
      ) : (
        <p className="stats-note">{t('stats.kind.tooFew')}</p>
      )}
    </section>
  )
}

function kindId({ width, height, winLength, players }: Stats['kinds'][number]): string {
  return [width, height, winLength, players].map(String).join('-')
}

function When({ stats }: { stats: Stats }) {
  const t = useText()
  const { weekday } = useFormat()
  const busiestDay = stats.weekdays.indexOf(Math.max(...stats.weekdays))
  const busiestHour = stats.hours.indexOf(Math.max(...stats.hours))
  return (
    <section className="stats-card" aria-labelledby="stats-when">
      <h3 id="stats-when">{t('stats.when.title')}</h3>
      <p>{t('stats.when.busiest', { day: weekday(busiestDay, 'long'), hour: busiestHour })}</p>
      <h4>{t('stats.when.perWeekday')}</h4>
      <Bars
        title={t('stats.when.perWeekdayChart')}
        bars={stats.weekdays.map((value, index) => ({
          label: weekday(index, 'short'),
          value,
          description: t('stats.when.weekdayBar', {
            day: weekday(index, 'long'),
            games: t('count.games', { count: value }),
          }),
        }))}
      />
      <h4>{t('stats.when.perHour')}</h4>
      <Bars
        title={t('stats.when.perHourChart')}
        bars={stats.hours.map((value, index) => ({
          label: index.toString(),
          value,
          description: t('stats.when.hourBar', {
            hour: index,
            games: t('count.games', { count: value }),
          }),
        }))}
        showValues={false}
        labelEvery={6}
      />
    </section>
  )
}

interface Fact {
  /** The shapes the fact is about, drawn before the text. */
  shapes: readonly ShapeId[]
  text: string
}

function Fun({ stats }: { stats: Stats }) {
  const t = useText()
  const { name } = useShapeNames()
  const { fastestWin, longestGame, longestRun, favouritePair } = stats.fun
  const facts: Fact[] = []
  if (fastestWin) {
    facts.push({
      shapes: [fastestWin.shape],
      text: t('stats.fun.fastest', {
        shape: name(fastestWin.shape),
        time: duration(t, fastestWin.milliseconds),
        moves: fastestWin.moves,
      }),
    })
  }
  if (longestGame) {
    facts.push({
      shapes: [],
      text: t('stats.fun.longestGame', {
        moves: longestGame.moves,
        width: longestGame.width,
        height: longestGame.height,
      }),
    })
  }
  if (longestRun && longestRun.wins >= 2) {
    facts.push({
      shapes: [longestRun.shape],
      text: t('stats.fun.longestRun', { shape: name(longestRun.shape), wins: longestRun.wins }),
    })
  }
  if (favouritePair) {
    const [one, two] = favouritePair.shapes
    facts.push({
      shapes: [one, two],
      text: t('stats.fun.pair', {
        one: name(one),
        two: name(two),
        games: t('count.games', { count: favouritePair.games }),
      }),
    })
  }
  if (facts.length === 0) return null
  return (
    <section className="stats-card" aria-labelledby="stats-fun">
      <h3 id="stats-fun">{t('stats.fun.title')}</h3>
      <ul className="stats-facts">
        {facts.map(({ shapes, text }) => (
          <li key={text}>
            {shapes.map((shape) => (
              <ShapeIcon key={shape} shape={shape} size={28} decorative />
            ))}
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
