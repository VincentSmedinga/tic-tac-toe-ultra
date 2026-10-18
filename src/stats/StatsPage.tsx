import { useEffect, useState } from 'react'
import type { Stats } from '../../shared/protocol.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import type { ShapeId } from '../shapes/shapes.ts'
import { statsApi } from './api.ts'
import type { StatsApi } from './api.ts'
import { HeatMap, Bars } from './Charts.tsx'
import { decimal, duration, games, kindName, percent, shapeName, shortDate } from './format.ts'
import '../online/Online.css'
import './Stats.css'

/** With fewer games than this the numbers say nothing yet: an average of two games is not one. */
export const MIN_GAMES = 3

const WEEKDAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const WEEKDAYS_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']

interface StatsPageProps {
  api?: StatsApi
}

/** "Statistieken": what the family has played, worked out from every finished game. */
export function StatsPage({ api = statsApi }: StatsPageProps) {
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
      <h2>Statistieken</h2>

      {stats === null && !failed && <p role="status">Statistieken ophalen…</p>}

      {failed && (
        <>
          <p className="message" role="alert">
            De statistieken zijn nu niet op te halen. Probeer het zo nog eens.
          </p>
          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              setFailed(false)
              setAttempt((count) => count + 1)
            }}
          >
            Opnieuw proberen
          </button>
        </>
      )}

      {stats !== null && stats.games < MIN_GAMES && <TooFew count={stats.games} />}
      {stats !== null && stats.games >= MIN_GAMES && <Numbers stats={stats} />}
    </div>
  )
}

function TooFew({ count }: { count: number }) {
  return (
    <section className="stats-card" aria-labelledby="stats-few">
      <h3 id="stats-few">Nog te weinig spellen</h3>
      <p>
        {count === 0
          ? 'Er is nog geen spel uitgespeeld.'
          : `Er ${count === 1 ? 'is' : 'zijn'} pas ${games(count)} uitgespeeld.`}{' '}
        Speel er een paar, dan staat hier wat jullie het vaakst doen.
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
  return (
    <section className="stats-card" aria-labelledby="stats-totals">
      <h3 id="stats-totals">Samen gespeeld</h3>
      <dl className="stats-figures">
        <div>
          <dt>Spellen</dt>
          <dd>{stats.games}</dd>
        </div>
        <div>
          <dt>Gewonnen</dt>
          <dd>{stats.won}</dd>
        </div>
        <div>
          <dt>Gelijkspel</dt>
          <dd>{stats.drawn}</dd>
        </div>
      </dl>
      <h4>Per week</h4>
      <Bars
        title="Spellen per week"
        bars={stats.weeks.map(({ start, won, drawn }) => ({
          label: shortDate(start),
          value: won + drawn,
          description: `Week van ${shortDate(start)}: ${games(won + drawn)}`,
        }))}
        labelEvery={4}
      />
    </section>
  )
}

function Lengths({ stats }: { stats: Stats }) {
  const { duration: time, moves } = stats
  if (moves === null) return null
  return (
    <section className="stats-card" aria-labelledby="stats-lengths">
      <h3 id="stats-lengths">Hoe lang duurt een spel?</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="stats-sr">Soort</span>
            </th>
            <th scope="col">Tijd</th>
            <th scope="col">Zetten</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Gemiddeld</th>
            <td>{time ? duration(time.average) : '–'}</td>
            <td>{decimal(moves.average)}</td>
          </tr>
          <tr>
            <th scope="row">Middelste</th>
            <td>{time ? duration(time.median) : '–'}</td>
            <td>{decimal(moves.median)}</td>
          </tr>
          <tr>
            <th scope="row">Kortste</th>
            <td>{time ? duration(time.shortest) : '–'}</td>
            <td>{moves.shortest}</td>
          </tr>
          <tr>
            <th scope="row">Langste</th>
            <td>{time ? duration(time.longest) : '–'}</td>
            <td>{moves.longest}</td>
          </tr>
        </tbody>
      </table>
      <p className="stats-note">
        {time === null
          ? 'De tijd is nog niet bijgehouden voor deze spellen.'
          : time.games === moves.games
            ? ''
            : `De tijd telt ${games(time.games)}: oudere spellen hebben geen tijd.`}
      </p>
    </section>
  )
}

function Shapes({ stats }: { stats: Stats }) {
  const most = Math.max(1, ...stats.shapes.map(({ games: played }) => played))
  return (
    <section className="stats-card" aria-labelledby="stats-shapes">
      <h3 id="stats-shapes">De vormen</h3>
      <ul className="stats-shapes">
        {stats.shapes.map(({ shape, games: played, won }) => (
          <li key={shape}>
            <ShapeIcon shape={shape} size={32} decorative />
            <span className="stats-shape-text">
              <strong>{shapeName(shape)}</strong>
              <span className="stats-bar-line" aria-hidden="true">
                <span
                  className="stats-bar-fill"
                  style={{ width: `${((played / most) * 100).toString()}%` }}
                />
              </span>
              <span>
                {games(played)}, {won} gewonnen ({percent(won, played)})
                {played < MIN_GAMES && <span className="stats-note"> · nog weinig spellen</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Starter({ stats }: { stats: Stats }) {
  const { won, lost, drawn } = stats.starter
  const total = won + lost + drawn
  if (total === 0) return null
  return (
    <section className="stats-card" aria-labelledby="stats-starter">
      <h3 id="stats-starter">Wie begint, wint die vaker?</h3>
      <p>
        De speler die begon won {won} van de {total} spellen ({percent(won, total)}), verloor er{' '}
        {lost} en speelde er {drawn} gelijk.
      </p>
      <StarterBar won={won} lost={lost} drawn={drawn} />
    </section>
  )
}

function StarterBar({ won, lost, drawn }: { won: number; lost: number; drawn: number }) {
  const total = Math.max(1, won + lost + drawn)
  const parts = [
    { key: 'won', label: 'Won', count: won },
    { key: 'drawn', label: 'Gelijk', count: drawn },
    { key: 'lost', label: 'Verloor', count: lost },
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
  const { width, height, winLength, players, games: played, won, drawn } = kind
  const enough = played >= MIN_GAMES
  return (
    <section className="stats-card" aria-labelledby={`stats-kind-${kindId(kind)}`}>
      <h3 id={`stats-kind-${kindId(kind)}`}>Veld van {kindName(width, height, winLength)}</h3>
      <p>
        {players} spelers, {games(played)}: {won} gewonnen en {drawn} gelijk. Gemiddeld{' '}
        {decimal(kind.averageMoves)} zetten.
      </p>
      {enough ? (
        <>
          <p>
            Wie begon won {kind.starter.won} keer, verloor er {kind.starter.lost} en speelde er{' '}
            {kind.starter.drawn} gelijk.
          </p>
          <div className="stats-heats">
            <HeatMap
              title="Waar begint iedereen?"
              width={width}
              height={height}
              counts={kind.firstMoves}
              unit="eerst gespeeld"
            />
            <HeatMap
              title="Waar staat de winnende rij?"
              width={width}
              height={height}
              counts={kind.winningCells}
              unit="in een winnende rij"
            />
          </div>
        </>
      ) : (
        <p className="stats-note">Nog te weinig spellen van dit soort voor meer.</p>
      )}
    </section>
  )
}

function kindId({ width, height, winLength, players }: Stats['kinds'][number]): string {
  return [width, height, winLength, players].map(String).join('-')
}

function When({ stats }: { stats: Stats }) {
  const busiestDay = stats.weekdays.indexOf(Math.max(...stats.weekdays))
  const busiestHour = stats.hours.indexOf(Math.max(...stats.hours))
  return (
    <section className="stats-card" aria-labelledby="stats-when">
      <h3 id="stats-when">Wanneer spelen we?</h3>
      <p>
        Het meest op {WEEKDAYS[busiestDay]} en rond {busiestHour} uur.
      </p>
      <h4>Per dag van de week</h4>
      <Bars
        title="Spellen per dag van de week"
        bars={stats.weekdays.map((value, index) => ({
          label: WEEKDAYS_SHORT[index] ?? '',
          value,
          description: `${WEEKDAYS[index] ?? ''}: ${games(value)}`,
        }))}
      />
      <h4>Per uur van de dag</h4>
      <Bars
        title="Spellen per uur van de dag"
        bars={stats.hours.map((value, index) => ({
          label: index.toString(),
          value,
          description: `${index.toString()} uur: ${games(value)}`,
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
  const { fastestWin, longestGame, longestRun, favouritePair } = stats.fun
  const facts: Fact[] = []
  if (fastestWin) {
    facts.push({
      shapes: [fastestWin.shape],
      text: `Snelste winst: ${lower(fastestWin.shape)} won in ${duration(fastestWin.milliseconds)} (${fastestWin.moves.toString()} zetten).`,
    })
  }
  if (longestGame) {
    facts.push({
      shapes: [],
      text: `Langste spel: ${longestGame.moves.toString()} zetten op een veld van ${longestGame.width.toString()} bij ${longestGame.height.toString()}.`,
    })
  }
  if (longestRun && longestRun.wins >= 2) {
    facts.push({
      shapes: [longestRun.shape],
      text: `Langste reeks: ${lower(longestRun.shape)} won ${longestRun.wins.toString()} spellen achter elkaar.`,
    })
  }
  if (favouritePair) {
    const [one, two] = favouritePair.shapes
    facts.push({
      shapes: [one, two],
      text: `Vaakst samen aan tafel: ${lower(one)} en ${lower(two)} (${games(favouritePair.games)}).`,
    })
  }
  if (facts.length === 0) return null
  return (
    <section className="stats-card" aria-labelledby="stats-fun">
      <h3 id="stats-fun">Leuk om te weten</h3>
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

function lower(shape: ShapeId): string {
  return shapeName(shape).toLowerCase()
}
