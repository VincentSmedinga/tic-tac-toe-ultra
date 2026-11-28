import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Cell } from '../../shared/game/index.ts'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import { ComputerGame } from './ComputerGame.tsx'
import { thinkingPause } from './computer.ts'
import type { Thinker } from './think.ts'
import { thinkOffThread } from './think.ts'

/** A computer that plays these cells (row, column, from 1) one after the other, at once. */
function scripted(...cells: readonly (readonly [number, number])[]) {
  const moves = [...cells]
  return vi.fn<Thinker>(() => {
    const move = moves.shift()
    return Promise.resolve(move ? { y: move[0] - 1, x: move[1] - 1 } : null)
  })
}

/** A computer that answers when the test says so. */
function waiting() {
  let answer: (cell: Cell) => void = () => undefined
  const think = vi.fn<Thinker>(
    () =>
      new Promise((resolve) => {
        answer = resolve
      }),
  )
  return {
    think,
    answer: async (y: number, x: number) => {
      await act(async () => {
        answer({ x: x - 1, y: y - 1 })
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
    },
  }
}

const atOnce = () => 0

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const group = (name: string) => within(screen.getByRole('group', { name }))
const status = () => screen.getByRole('status')

/** The cell at row `y` and column `x`, counted from 1 like the labels do. */
const cell = (y: number, x: number) =>
  button(new RegExp(`^Rij ${y.toString()}, kolom ${x.toString()}:`))

async function start(think: Thinker, choose: readonly string[] = []) {
  const user = userEvent.setup()
  render(<ComputerGame think={think} pause={atOnce} />)
  for (const name of choose) await user.click(button(new RegExp(`^${name}`)))
  await user.click(button('Start'))
  return user
}

describe('a game against the computer', () => {
  describe('the choices', () => {
    it('begin with the classic field, a computer of medium strength and you to start', () => {
      render(<ComputerGame />)
      expect(button(/^Klassiek/)).toHaveAttribute('aria-pressed', 'true')
      expect(group('Hoe sterk').getByRole('button', { name: /^Gemiddeld/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(group('Wie begint?').getByRole('button', { name: 'Ik' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(group('Kies je vorm').getByRole('button', { name: 'kruis' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(button(/^De computer speelt met: cirkel/)).toBeVisible()
    })

    it('say that the hard computer can’t be beaten on the classic field only', async () => {
      const user = userEvent.setup()
      render(<ComputerGame />)
      expect(button(/^Moeilijk/)).toHaveTextContent('niet te verslaan')
      await user.click(button(/^Groter/))
      expect(button(/^Moeilijk/)).toHaveTextContent('denkt vooruit')
    })

    it('offer a character on a bigger field, and not on the classic one', async () => {
      const user = userEvent.setup()
      render(<ComputerGame />)
      expect(screen.queryByRole('group', { name: 'Karakter' })).not.toBeInTheDocument()
      expect(screen.getByText('Op een groter veld kies je ook een karakter.')).toBeVisible()

      await user.click(button(/^Groter/))
      const characters = group('Karakter').getAllByRole('button')
      expect(characters.map((choice) => choice.firstChild?.textContent)).toEqual([
        'Gewoon',
        'Verdediger',
        'Aanvaller',
        'Wildebras',
      ])
    })

    it('give the computer another shape when you take its shape', async () => {
      const user = userEvent.setup()
      render(<ComputerGame />)
      await user.click(group('Kies je vorm').getByRole('button', { name: 'cirkel' }))
      expect(button(/^De computer speelt met: kruis/)).toBeVisible()
    })

    it('let you choose the computer’s shape, but not yours', async () => {
      const user = userEvent.setup()
      render(<ComputerGame />)
      await user.click(button(/^De computer speelt met/))
      const theirs = group('Vorm van de computer')
      expect(theirs.getByRole('button', { name: 'kruis, van jou' })).toBeDisabled()
      await user.click(theirs.getByRole('button', { name: 'hart' }))
      expect(button(/^De computer speelt met: hart/)).toBeVisible()
    })
  })

  it('asks the computer with the level and the character you chose', async () => {
    const think = scripted()
    await start(think, ['Groter', 'Moeilijk', 'Wildebras', 'Computer'])
    expect(think).toHaveBeenCalledTimes(1)
    const [game, player, bot] = think.mock.calls[0] ?? []
    expect(game?.config).toMatchObject({ width: 7, winLength: 5, players: ['circle', 'cross'] })
    expect(player).toBe('circle')
    expect(bot).toEqual({ level: 'hard', character: 'wild' })
    expect(screen.getByText('Computer: Moeilijk, Wildebras')).toBeVisible()
  })

  it('has an even-handed computer on the classic field, whatever was chosen before', async () => {
    const think = scripted()
    await start(think, ['Groter', 'Aanvaller', 'Klassiek', 'Computer'])
    expect(think.mock.calls[0]?.[2]).toEqual({ level: 'medium', character: 'balanced' })
    expect(screen.getByText('Computer: Gemiddeld')).toBeVisible()
  })

  it('takes turns: you move, the computer thinks, and says where it played', async () => {
    const computer = waiting()
    const user = await start(computer.think)
    expect(status()).toHaveTextContent('Jij begint')
    expect(computer.think).not.toHaveBeenCalled()

    await user.click(cell(1, 1))
    expect(status()).toHaveTextContent('Computer denkt na…')
    // Not your turn: no cell can be played.
    expect(cell(3, 3)).toHaveAttribute('aria-disabled', 'true')
    await user.click(cell(3, 3))
    expect(cell(3, 3)).toHaveAccessibleName('Rij 3, kolom 3: leeg')

    await computer.answer(2, 2)
    expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
    expect(status()).toHaveTextContent(
      'De computer speelde in rij 2, kolom 2. Jij bent aan de beurt',
    )
    expect(cell(3, 3)).toHaveAttribute('aria-disabled', 'false')
  })

  it('waits for its pause before the move is on the board', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) })
      render(<ComputerGame think={scripted([2, 2])} pause={() => 5000} />)
      await user.click(button('Start'))
      await user.click(cell(1, 1))
      await act(() => vi.advanceTimersByTimeAsync(4000))
      expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: leeg')
      await act(() => vi.advanceTimersByTimeAsync(1100))
      expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
    } finally {
      vi.useRealTimers()
    }
  })

  it('pauses shorter on a small field than on a big one, never twice the same', () => {
    const config = (side: number) => ({
      width: side,
      height: side,
      winLength: 3,
      players: ['cross', 'circle'],
    })
    expect(thinkingPause(config(3), 0)).toBeLessThan(thinkingPause(config(7), 0))
    expect(thinkingPause(config(3), 0)).toBeLessThan(thinkingPause(config(3), 1))
  })

  it('can be won, and lets the computer start the next round', async () => {
    const think = scripted([2, 1], [2, 2], [3, 3])
    const user = await start(think)
    await user.click(cell(1, 1))
    await user.click(await screen.findByRole('button', { name: 'Rij 1, kolom 2: leeg' }))
    await user.click(await screen.findByRole('button', { name: 'Rij 1, kolom 3: leeg' }))
    expect(status()).toHaveTextContent('Je hebt gewonnen!')

    await user.click(button('Nog een keer'))
    expect(await screen.findByRole('button', { name: 'Rij 3, kolom 3: cirkel' })).toBeVisible()
    expect(status()).toHaveTextContent('Jij bent aan de beurt')
  })

  it('can be lost', async () => {
    const user = await start(scripted([1, 1], [1, 2], [1, 3]), ['Computer'])
    for (const [y, x] of [
      [2, 1],
      [2, 2],
    ] as const) {
      await screen.findByText('Jij bent aan de beurt', { exact: false })
      await user.click(cell(y, x))
    }
    expect(await screen.findByText('De computer heeft gewonnen!', { exact: false })).toBeVisible()
    expect(button('Kijk terug')).toBeVisible()
    expect(button('Bekijk samenvatting')).toBeVisible()
  })

  it('goes back to the choices as they were, and drops the move it was thinking of', async () => {
    const computer = waiting()
    const user = await start(computer.think, ['Makkelijk'])
    for (const [y, x] of [
      [1, 1],
      [1, 2],
      [1, 3],
    ] as const) {
      await user.click(cell(y, x))
      if (x < 3) await computer.answer(3, x)
    }
    await user.click(button('Andere keuzes'))
    expect(button(/^Makkelijk/)).toHaveAttribute('aria-pressed', 'true')

    await user.click(group('Wie begint?').getByRole('button', { name: 'Computer' }))
    await user.click(button('Start'))
    await user.click(button('Volledig scherm'))
    expect(screen.getByText('Computer', { selector: '.player span' })).toBeVisible()
    expect(screen.getByText('Jij', { selector: '.player span' })).toBeVisible()
  })

  it('plays moves of its own when nobody tells it which', async () => {
    const user = userEvent.setup()
    render(<ComputerGame think={thinkOffThread} pause={atOnce} />)
    await user.click(button('Start'))
    await user.click(cell(2, 2))
    expect(await screen.findByText('Jij bent aan de beurt', { exact: false })).toBeVisible()
    expect(screen.getAllByRole('button', { name: /: cirkel$/ })).toHaveLength(1)
  })

  describe.each([
    ['en', 'Start', 'Against the computer', /^Row 1, column 1:/, 'The computer is thinking…'],
    ['fy', 'Start', 'Tsjin de kompjûter', /^Rige 1, kolom 1:/, 'De kompjûter tinkt nei…'],
  ] as const)('in %s', (language, startName, title, first, thinking) => {
    it('has no Dutch on the choices or in the game', async () => {
      setLanguage(language)
      const user = userEvent.setup()
      render(<ComputerGame think={waiting().think} pause={atOnce} />)
      expect(screen.getByRole('region', { name: title })).toBeVisible()
      await user.click(screen.getByRole('button', { name: /^(Bigger|Grutter)/ }))
      expect(dutchLeaks(language)).toEqual([])
      await user.click(screen.getByRole('button', { name: startName }))
      await user.click(screen.getByRole('button', { name: first }))
      expect(screen.getByRole('status')).toHaveTextContent(thinking)
      expect(dutchLeaks(language)).toEqual([])
    })
  })
})
