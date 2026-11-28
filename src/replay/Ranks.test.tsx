import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { analyseGame } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import type { Analyser } from './analyse.ts'
import { Replay } from './Replay.tsx'

const CLASSIC: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

const at = (player: string, index: number, width = 3): Move => ({
  player,
  x: index % width,
  y: Math.floor(index / width),
})

// X0 O1 (a blunder: only the middle holds the draw) X2 (a mistake) O7 (a blunder) X4 (a fork)
// O8 X6 (wins). It is the example of docs/plan.md.
const GAME: Move[] = [
  at('X', 0),
  at('O', 1),
  at('X', 2),
  at('O', 7),
  at('X', 4),
  at('O', 8),
  at('X', 6),
]

/** The real analysis, as a promise that is there at once. */
const analyse: Analyser = (config, moves) => Promise.resolve(analyseGame(config, moves))

/** A thing a test needs to be there. */
function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected a value')
  return value
}
const ready = () =>
  screen.findByRole('navigation', { name: /Beoordeelde zetten|Judged moves|Beoardiele/ })
const slider = () => screen.getByRole('slider')
/** The line under the slider that says how the move just made was judged. */
const rankLine = () => document.querySelector('[aria-live="polite"]')

describe('the ranks in the replay', () => {
  it('says that the moves are being judged, and then stops saying so', async () => {
    let finish: (value: ReturnType<typeof analyseGame>) => void = () => undefined
    const slow: Analyser = () =>
      new Promise((resolve) => {
        finish = resolve
      })
    render(<Replay config={CLASSIC} moves={GAME} analyse={slow} />)
    expect(screen.getByText('Zetten beoordelen…')).toBeVisible()
    // The replay works meanwhile.
    await userEvent.setup().click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(slider()).toHaveValue('1')
    expect(screen.queryByRole('heading', { name: 'Samenvatting' })).not.toBeInTheDocument()

    finish(analyseGame(CLASSIC, GAME))
    await screen.findByRole('heading', { name: 'Samenvatting' })
    expect(screen.queryByText('Zetten beoordelen…')).not.toBeInTheDocument()
  })

  it('says so when the moves cannot be judged, and the replay carries on', async () => {
    const broken: Analyser = () => Promise.reject(new Error('no worker'))
    render(<Replay config={CLASSIC} moves={GAME} analyse={broken} />)
    expect(await screen.findByText('De zetten zijn nu niet te beoordelen.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Een zet verder' })).toBeEnabled()
    expect(screen.queryByRole('heading', { name: 'Samenvatting' })).not.toBeInTheDocument()
  })

  it('shows the rank of the move just made, with its symbol and its word', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    await ready()

    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    // X's first move is an ordinary one.
    expect(rankLine()).toBeEmptyDOMElement()
    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(rankLine()).toHaveTextContent('Cirkel · ?? Blunder')
    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(rankLine()).toHaveTextContent('Kruis · ? Fout')
  })

  it('marks the cell that would have been better, and says where it is', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(screen.queryByText(/Beter was/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))

    expect(screen.getByText('Beter was: rij 2, kolom 2')).toBeVisible()
    const middle = screen.getByRole('button', { name: /^Rij 2, kolom 2:/ })
    expect(middle).toHaveAttribute('data-better')
    expect(
      screen.getAllByRole('button', { name: /^Rij/ }).filter((c) => c.hasAttribute('data-better')),
    ).toHaveLength(1)

    // It goes away with a move that was not a mistake: the fifth is the fork.
    await user.click(screen.getByRole('button', { name: 'Zet 5: Kruis, Briljant' }))
    expect(document.querySelectorAll('[data-better]')).toHaveLength(0)
    expect(screen.queryByText(/Beter was/)).not.toBeInTheDocument()
  })

  it('lists the judged moves along the slider, and a tap goes to the move', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    const list = await ready()
    const moves = within(list).getAllByRole('button')
    // Moves 2, 3, 4 and 5 have a rank: blunder, mistake, blunder, brilliant.
    expect(moves.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Zet 2: Cirkel, Blunder',
      'Zet 3: Kruis, Fout',
      'Zet 4: Cirkel, Blunder',
      'Zet 5: Kruis, Briljant',
    ])
    await user.click(must(moves[3]))
    expect(slider()).toHaveValue('5')
    expect(slider()).toHaveFocus()
    expect(moves[3]).toHaveAttribute('aria-current', 'step')
    expect(moves[0]).not.toHaveAttribute('aria-current')
  })

  it('tells a screen reader what a symbol means: every rank has its word next to it', async () => {
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    await ready()
    for (const badge of document.querySelectorAll('.rank-badge')) {
      expect(badge).toHaveAttribute('aria-hidden', 'true')
    }
    expect(screen.getByRole('button', { name: 'Zet 5: Kruis, Briljant' })).toBeVisible()
  })

  it('says a move was judged on what is clear only when it was, for several players', async () => {
    const three: GameConfig = {
      width: 6,
      height: 6,
      winLength: 3,
      players: ['cross', 'circle', 'heart'],
    }
    const moves = [0, 30, 31, 1, 32, 33, 20].map((index, turn) =>
      at(three.players[turn % 3] ?? '', index, 6),
    )
    const user = userEvent.setup()
    render(<Replay config={three} moves={moves} analyse={analyse} />)
    await ready()
    await user.click(screen.getByRole('button', { name: 'Naar het einde' }))
    expect(screen.getByText('Kruis · ? Fout')).toBeVisible()
    expect(screen.getByText('(minder zeker)')).toBeVisible()
    expect(screen.getByText(/Alleen de duidelijkste zetten zijn beoordeeld\./)).toBeVisible()
    expect(screen.getByText(/Bij meer dan twee spelers/)).toBeVisible()
    // No accuracy is claimed for a game that was not solved.
    expect(screen.queryByText(/Nauwkeurigheid/)).not.toBeInTheDocument()
  })
})

describe('the summary in the replay', () => {
  it('sums up each player: the moves of each rank, the accuracy and a sentence', async () => {
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    const heading = await screen.findByRole('heading', { name: 'Samenvatting' })
    const section = must(heading.closest('section'))
    const [cross, circle] = within(section).getAllByRole('article')

    expect(cross).toHaveAccessibleName('Kruis')
    expect(within(must(cross)).getByText('Kruis · 4 zetten')).toBeVisible()
    expect(within(must(cross)).getByText('Kruis maakte 1 foute zet.')).toBeVisible()
    expect(within(must(cross)).getByText('Fout: 1')).toBeVisible()
    expect(within(must(cross)).getByText('Briljant: 1')).toBeVisible()
    expect(within(must(cross)).getByText('Nauwkeurigheid: 75%')).toBeVisible()
    expect(
      within(must(cross)).getByText(
        /Het deel van de zetten dat de stand hield zoals hij was, op basis van 4 zetten/,
      ),
    ).toBeVisible()

    expect(within(must(circle)).getByText('Cirkel maakte 2 foute zetten.')).toBeVisible()
    expect(within(must(circle)).getByText('Blunder: 2')).toBeVisible()
    expect(within(must(circle)).getByText('Nauwkeurigheid: 33%')).toBeVisible()
    expect(screen.queryByText(/Alleen de duidelijkste zetten/)).not.toBeInTheDocument()
  })

  it('says a player played almost flawlessly when no move gave value away', async () => {
    const moves = [at('X', 4), at('O', 0), at('X', 8)]
    render(<Replay config={CLASSIC} moves={moves} analyse={analyse} />)
    await screen.findByRole('heading', { name: 'Samenvatting' })
    expect(screen.getByText('Kruis speelde bijna foutloos.')).toBeVisible()
  })

  it('jumps the replay to the best move and to the biggest mistake', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    await screen.findByRole('heading', { name: 'Samenvatting' })

    await user.click(screen.getByRole('button', { name: 'Beste zet: zet 5 · !! Briljant' }))
    expect(slider()).toHaveValue('5')
    expect(slider()).toHaveFocus()
    expect(screen.getByText('Kruis · !! Briljant')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Grootste fout: zet 2 · ?? Blunder' }))
    expect(slider()).toHaveValue('2')
  })

  it('opens at the end, on the summary, when it is asked to', async () => {
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} startAtSummary />)
    expect(slider()).toHaveValue('7')
    const heading = await screen.findByRole('heading', { name: 'Samenvatting' })
    await waitFor(() => {
      expect(heading).toHaveFocus()
    })
  })

  it('reads a game stored with the old players X and O as the cross and the circle', async () => {
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    await screen.findByRole('heading', { name: 'Samenvatting' })
    expect(screen.getByRole('article', { name: 'Kruis' })).toBeVisible()
    expect(screen.getByRole('article', { name: 'Cirkel' })).toBeVisible()
  })

  it('judges the game with the real analysis when it is given no other', async () => {
    render(<Replay config={CLASSIC} moves={GAME} />)
    expect(await screen.findByRole('heading', { name: 'Samenvatting' })).toBeVisible()
  })
})

describe.each([
  {
    language: 'en',
    nav: 'Judged moves',
    summary: 'Summary',
    blunder: 'Circle · ?? Blunder',
    better: 'Better was: row 2, column 2',
    sentence: 'Circle made 2 wrong moves.',
    accuracy: 'Accuracy: 33%',
    jump: 'Biggest mistake: move 2 · ?? Blunder',
    item: 'Move 2: Circle, Blunder',
  },
  {
    language: 'fy',
    nav: 'Beoardiele sets',
    summary: 'Gearfetting',
    blunder: 'Sirkel · ?? Blunder',
    better: 'Better wie: rige 2, kolom 2',
    sentence: 'Sirkel makke 2 flaters.',
    accuracy: 'Krektens: 33%',
    jump: 'Grutste flater: set 2 · ?? Blunder',
    item: 'Set 2: Sirkel, Blunder',
  },
] as const)('the ranks in $language', (text) => {
  it('names the ranks, the summary and the better move in the language', async () => {
    setLanguage(text.language)
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={GAME} analyse={analyse} />)
    expect(await screen.findByRole('navigation', { name: text.nav })).toBeVisible()
    expect(screen.getByRole('heading', { name: text.summary })).toBeVisible()
    expect(screen.getByText(text.sentence)).toBeVisible()
    expect(screen.getByText(text.accuracy)).toBeVisible()
    expect(screen.getByRole('button', { name: text.jump })).toBeVisible()
    expect(screen.getByRole('button', { name: text.item })).toBeVisible()
    expect(dutchLeaks(text.language)).toEqual([])

    await user.click(screen.getByRole('button', { name: text.item }))
    expect(screen.getByText(text.blunder)).toBeVisible()
    expect(screen.getByText(text.better)).toBeVisible()
    expect(dutchLeaks(text.language)).toEqual([])
  })
})
