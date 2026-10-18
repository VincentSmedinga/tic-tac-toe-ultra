import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Stats } from '../../shared/protocol.ts'
import { computeStats } from '../../shared/stats.ts'
import type { StatsApi } from './api.ts'
import { StatsPage } from './StatsPage.tsx'

const EMPTY = computeStats([], Date.UTC(2026, 9, 18, 12))

/** The numbers of 9 classic games, as the server would count them. */
const NINE: Stats = {
  ...EMPTY,
  games: 9,
  won: 7,
  drawn: 2,
  weeks: EMPTY.weeks.map((week, index) =>
    index === 11
      ? { ...week, won: 7, drawn: 2 }
      : index === 10
        ? { ...week, won: 0, drawn: 0 }
        : week,
  ),
  duration: { games: 6, average: 125_000, median: 90_000, shortest: 40_000, longest: 300_000 },
  moves: { games: 9, average: 6.25, median: 5, shortest: 5, longest: 9 },
  shapes: [
    { shape: 'cross', games: 9, won: 4, drawn: 2 },
    { shape: 'circle', games: 7, won: 3, drawn: 2 },
    { shape: 'heart', games: 2, won: 0, drawn: 0 },
  ],
  starter: { won: 5, lost: 2, drawn: 2 },
  rooms: {
    made: 5,
    played: 4,
    rematches: 3,
    averageRounds: 2.25,
    mostRounds: 6,
    rounds: [1, 1, 1, 0, 1],
  },
  kinds: [
    {
      width: 3,
      height: 3,
      winLength: 3,
      players: 2,
      games: 9,
      won: 7,
      drawn: 2,
      starter: { won: 5, lost: 2, drawn: 2 },
      averageMoves: 6.25,
      firstMoves: [4, 0, 0, 0, 5, 0, 0, 0, 0],
      winningCells: [3, 1, 2, 0, 7, 0, 2, 1, 3],
    },
    {
      width: 7,
      height: 7,
      winLength: 5,
      players: 3,
      games: 1,
      won: 1,
      drawn: 0,
      starter: { won: 1, lost: 0, drawn: 0 },
      averageMoves: 20,
      firstMoves: Array.from({ length: 49 }, () => 0),
      winningCells: Array.from({ length: 49 }, () => 0),
    },
  ],
  weekdays: [0, 1, 0, 0, 2, 5, 1],
  hours: Array.from({ length: 24 }, (_, hour) => (hour === 20 ? 6 : hour === 14 ? 3 : 0)),
  fun: {
    fastestWin: { shape: 'heart', milliseconds: 40_000, moves: 5 },
    longestGame: { moves: 9, width: 3, height: 3 },
    longestRun: { shape: 'cross', wins: 3 },
    favouritePair: { shapes: ['circle', 'cross'], games: 7 },
  },
}

const apiWith = (stats: Stats): StatsApi => ({ getStats: vi.fn(() => Promise.resolve(stats)) })

describe('StatsPage', () => {
  it('says it is fetching, then shows the title', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    expect(screen.getByRole('status')).toHaveTextContent('Statistieken ophalen')
    expect(screen.getByRole('heading', { name: 'Statistieken', level: 2 })).toBeVisible()
    await screen.findByRole('heading', { name: 'Samen gespeeld' })
  })

  it('says there are too few games instead of averages of nothing', async () => {
    render(<StatsPage api={apiWith(EMPTY)} />)
    expect(await screen.findByRole('heading', { name: 'Nog te weinig spellen' })).toBeVisible()
    expect(screen.getByText(/nog geen spel uitgespeeld/)).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Hoe lang duurt een spel?' }),
    ).not.toBeInTheDocument()
  })

  it('says it too for one or two games, and says how many there are', async () => {
    const { unmount } = render(<StatsPage api={apiWith({ ...EMPTY, games: 1, won: 1 })} />)
    expect(await screen.findByText(/pas 1 spel uitgespeeld/)).toBeVisible()
    unmount()
    render(<StatsPage api={apiWith({ ...EMPTY, games: 2, won: 2 })} />)
    expect(await screen.findByText(/pas 2 spellen uitgespeeld/)).toBeVisible()
  })

  it('shows the totals and the weeks, with every week as text for screen readers', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const totals = within(await screen.findByRole('region', { name: 'Samen gespeeld' }))
    expect(totals.getByText('Spellen').closest('div')).toHaveTextContent('9')
    expect(totals.getByText('Gewonnen').closest('div')).toHaveTextContent('7')
    expect(totals.getByText('Gelijkspel').closest('div')).toHaveTextContent('2')
    expect(totals.getByText('Week van 12 okt: 9 spellen')).toBeInTheDocument()
    expect(totals.getAllByRole('listitem')).toHaveLength(12)
  })

  it('shows how long games take, in time and moves', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const table = within(
      (await screen.findByRole('region', { name: 'Hoe lang duurt een spel?' })).querySelector(
        'table',
      ) as HTMLElement,
    )
    expect(table.getByRole('row', { name: /Gemiddeld/ })).toHaveTextContent('2 min 5 s6,3')
    expect(table.getByRole('row', { name: /Kortste/ })).toHaveTextContent('40 s5')
    expect(table.getByRole('row', { name: /Langste/ })).toHaveTextContent('5 min9')
    expect(
      screen.getByText('De tijd telt 6 spellen: oudere spellen hebben geen tijd.'),
    ).toBeVisible()
  })

  it('shows the moves when no game has a time', async () => {
    render(<StatsPage api={apiWith({ ...NINE, duration: null })} />)
    const section = within(await screen.findByRole('region', { name: 'Hoe lang duurt een spel?' }))
    expect(section.getByRole('row', { name: /Gemiddeld/ })).toHaveTextContent('–6,3')
    expect(section.getByText(/nog niet bijgehouden/)).toBeVisible()
  })

  it('shows each shape with how often it won, and warns about a shape with few games', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const shapes = within(await screen.findByRole('region', { name: 'De vormen' }))
    const items = shapes.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Kruis')
    expect(items[0]).toHaveTextContent('9 spellen, 4 gewonnen (44%)')
    expect(items[2]).toHaveTextContent('Hart')
    expect(items[2]).toHaveTextContent('2 spellen, 0 gewonnen (0%)')
    expect(items[2]).toHaveTextContent('nog weinig spellen')
    expect(items[0]).not.toHaveTextContent('nog weinig spellen')
  })

  it('says whether the player who starts wins', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const section = within(
      await screen.findByRole('region', { name: 'Wie begint, wint die vaker?' }),
    )
    expect(
      section.getByText(
        'De speler die begon won 5 van de 9 spellen (56%), verloor er 2 en speelde er 2 gelijk.',
      ),
    ).toBeVisible()
  })

  it('shows the rooms and how often there was a rematch', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const rooms = within(await screen.findByRole('region', { name: 'Kamers en herkansingen' }))
    expect(
      rooms.getByText(
        'Er zijn 5 kamers gemaakt. In 4 daarvan is een spel uitgespeeld, en in 3 (75%) is daarna nog een keer gespeeld.',
      ),
    ).toBeVisible()
    expect(rooms.getByText('Gemiddeld 2,3 rondes per kamer, de meeste 6.')).toBeVisible()
    expect(rooms.getByText('5 of meer rondes: 1 kamer')).toBeInTheDocument()
    expect(rooms.getByText('1 ronde: 1 kamer')).toBeInTheDocument()
  })

  it('leaves out the rooms when none were counted, and the rounds when no room finished a game', async () => {
    const none = { ...NINE.rooms, made: 0, played: 0, rematches: 0, rounds: [0, 0, 0, 0, 0] }
    const { unmount } = render(<StatsPage api={apiWith({ ...NINE, rooms: none })} />)
    await screen.findByRole('region', { name: 'Samen gespeeld' })
    expect(screen.queryByRole('region', { name: 'Kamers en herkansingen' })).not.toBeInTheDocument()
    unmount()

    render(<StatsPage api={apiWith({ ...NINE, rooms: { ...none, made: 1 } })} />)
    const rooms = within(await screen.findByRole('region', { name: 'Kamers en herkansingen' }))
    expect(rooms.getByText('Er is 1 kamer gemaakt.')).toBeVisible()
    expect(rooms.queryByText(/Gemiddeld/)).not.toBeInTheDocument()
  })

  it('shows a heat map for each kind of game, with its busiest cells in words', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const classic = within(
      await screen.findByRole('region', { name: 'Veld van 3 bij 3, 3 op een rij' }),
    )
    expect(classic.getByText(/2 spelers, 9 spellen: 7 gewonnen en 2 gelijk/)).toBeVisible()
    const first = classic.getByRole('img', { name: /Waar begint iedereen\?/ })
    expect(first).toHaveAccessibleName(
      'Waar begint iedereen?: rij 2, kolom 2 (5×); rij 1, kolom 1 (4×)',
    )
    expect(classic.getByText(/Het vaakst eerst gespeeld: rij 2, kolom 2 \(5×\)/)).toBeVisible()
    expect(
      classic.getByRole('img', { name: /Waar staat de winnende rij\?: rij 2, kolom 2 \(7×\)/ }),
    ).toBeVisible()
  })

  it('does not draw heat maps for a kind with too few games', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const bigger = within(
      await screen.findByRole('region', { name: 'Veld van 7 bij 7, 5 op een rij' }),
    )
    expect(bigger.getByText(/Nog te weinig spellen van dit soort/)).toBeVisible()
    expect(bigger.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows when the family plays', async () => {
    render(<StatsPage api={apiWith(NINE)} />)
    const when = within(await screen.findByRole('region', { name: 'Wanneer spelen we?' }))
    expect(when.getByText('Het meest op zaterdag en rond 20 uur.')).toBeVisible()
    expect(when.getByText('zaterdag: 5 spellen')).toBeInTheDocument()
    expect(when.getByText('20 uur: 6 spellen')).toBeInTheDocument()
  })

  it('shows the fun ones, and leaves out a run of one win', async () => {
    const { unmount } = render(<StatsPage api={apiWith(NINE)} />)
    const fun = within(await screen.findByRole('region', { name: 'Leuk om te weten' }))
    expect(fun.getByText('Snelste winst: hart won in 40 s (5 zetten).')).toBeVisible()
    expect(fun.getByText('Langste spel: 9 zetten op een veld van 3 bij 3.')).toBeVisible()
    expect(fun.getByText('Langste reeks: kruis won 3 spellen achter elkaar.')).toBeVisible()
    expect(fun.getByText('Vaakst samen aan tafel: cirkel en kruis (7 spellen).')).toBeVisible()
    unmount()

    render(
      <StatsPage
        api={apiWith({ ...NINE, fun: { ...NINE.fun, longestRun: { shape: 'cross', wins: 1 } } })}
      />,
    )
    await screen.findByRole('region', { name: 'Leuk om te weten' })
    expect(screen.queryByText(/Langste reeks/)).not.toBeInTheDocument()
  })

  it('says so when the numbers cannot be fetched, and tries again', async () => {
    const getStats = vi
      .fn<StatsApi['getStats']>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(NINE)
    render(<StatsPage api={{ getStats }} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('niet op te halen')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Opnieuw proberen' }))
    expect(await screen.findByRole('heading', { name: 'Samen gespeeld' })).toBeVisible()
    expect(getStats).toHaveBeenCalledTimes(2)
  })
})
