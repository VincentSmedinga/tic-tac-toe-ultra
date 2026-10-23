import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import { Game } from './Game.tsx'

/** Opens the game and starts it with the cross and the circle that are ready. */
async function startGame() {
  render(<Game />)
  await userEvent.click(screen.getByRole('button', { name: 'Start' }))
}

/** The cell at row `y` and column `x`, counted from 1 like the labels do. */
function cell(y: number, x: number) {
  return screen.getByRole('button', {
    name: new RegExp(`^Rij ${y.toString()}, kolom ${x.toString()}:`),
  })
}

/** Taps the cells (row, column) one after the other. */
async function tap(...cells: readonly (readonly [number, number])[]) {
  const user = userEvent.setup()
  for (const [y, x] of cells) await user.click(cell(y, x))
  return user
}

// The cross wins on the top row.
const crossWins = [
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
  [1, 3],
] as const

describe('Game', () => {
  it('starts with an empty field and the cross to play', async () => {
    await startGame()
    expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(9)
    expect(screen.getByRole('status')).toHaveTextContent('Kruis begint')
    expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: leeg')
  })

  it('lets the players take turns', async () => {
    await startGame()
    await tap([1, 1])
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
    expect(screen.getByRole('status')).toHaveTextContent('Cirkel is aan de beurt')

    await tap([2, 2])
    expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
    expect(screen.getByRole('status')).toHaveTextContent('Kruis is aan de beurt')
  })

  it('ignores a tap on a cell that is taken', async () => {
    await startGame()
    await tap([1, 1], [1, 1])
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
    expect(screen.getByRole('status')).toHaveTextContent('Cirkel is aan de beurt')
  })

  it('can be played with the keyboard: one stop, the arrow keys over the cells', async () => {
    const user = userEvent.setup()
    await startGame()
    // The button for the full screen comes first, then the board.
    await user.tab()
    await user.tab()
    expect(cell(1, 1)).toHaveFocus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(cell(1, 2)).toHaveAccessibleName('Rij 1, kolom 2: kruis')
    await user.keyboard('{ArrowRight}{ }')
    expect(cell(1, 3)).toHaveAccessibleName('Rij 1, kolom 3: cirkel')
  })

  it('is one tab stop, however many cells it has', async () => {
    await startGame()
    const stops = screen
      .getAllByRole('button', { name: /^Rij / })
      .filter((cell) => cell.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
  })

  it('moves over the cells with the arrow keys, Home and End, and stops at the edge', async () => {
    const user = userEvent.setup()
    await startGame()
    // The button for the full screen comes first, then the board.
    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(cell(1, 1)).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}')
    expect(cell(3, 1)).toHaveFocus()
    await user.keyboard('{End}')
    expect(cell(3, 3)).toHaveFocus()
    await user.keyboard('{Home}')
    expect(cell(3, 1)).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowUp}')
    expect(cell(2, 2)).toHaveFocus()
  })

  it('goes back in at the cell it was on', async () => {
    const user = userEvent.setup()
    await startGame()
    // The button for the full screen comes first, then the board.
    await user.tab()
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowRight}')
    await user.tab()
    await user.tab({ shift: true })
    expect(cell(2, 2)).toHaveFocus()
  })

  describe('when someone wins', () => {
    it('says who won and marks the winning line', async () => {
      await startGame()
      await tap(...crossWins)
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
      for (const x of [1, 2, 3]) expect(cell(1, x)).toHaveAttribute('data-winning')
      expect(cell(2, 1)).not.toHaveAttribute('data-winning')
    })

    it('marks every line the last move completes, each cell once: five cells for a row and a column', async () => {
      await startGame()
      // X takes the top row and the right column, and the corner (row 1, column 3) completes both.
      await tap([1, 1], [2, 1], [1, 2], [2, 2], [2, 3], [3, 1], [3, 3], [3, 2], [1, 3])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')

      const marked = screen
        .getAllByRole('button', { name: /^Rij/ })
        .filter((button) => button.hasAttribute('data-winning'))
      expect(marked.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Rij 1, kolom 1: kruis',
        'Rij 1, kolom 2: kruis',
        'Rij 1, kolom 3: kruis',
        'Rij 2, kolom 3: kruis',
        'Rij 3, kolom 3: kruis',
      ])
    })

    it('takes no more moves', async () => {
      await startGame()
      await tap(...crossWins, [3, 3])
      expect(cell(3, 3)).toHaveAccessibleName('Rij 3, kolom 3: leeg')
      expect(cell(3, 3)).toHaveAttribute('aria-disabled', 'true')
    })

    it('lets the other player start the next round after "Nog een keer"', async () => {
      await startGame()
      const user = await tap(...crossWins)
      await user.click(screen.getByRole('button', { name: 'Nog een keer' }))

      expect(screen.getByRole('status')).toHaveTextContent('Cirkel begint')
      for (const name of screen.getAllByRole('button', { name: /^Rij/ })) {
        expect(name).toHaveAccessibleName(/: leeg$/)
        expect(name).not.toHaveAttribute('data-winning')
      }
      expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()

      await user.click(cell(2, 2))
      expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
    })
  })

  it('declares a draw, and offers another round', async () => {
    await startGame()
    await tap([1, 1], [1, 2], [1, 3], [2, 2], [2, 1], [2, 3], [3, 2], [3, 1], [3, 3])
    expect(screen.getByRole('status')).toHaveTextContent('Gelijkspel!')
    expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    for (const name of screen.getAllByRole('button', { name: /^Rij/ })) {
      expect(name).not.toHaveAttribute('data-winning')
    }
  })

  describe('looking back', () => {
    it('is not offered while the game is on', async () => {
      await startGame()
      expect(screen.queryByRole('button', { name: 'Kijk terug' })).not.toBeInTheDocument()
    })

    it('replays the game just played, and goes back to the end of it', async () => {
      await startGame()
      const user = await tap(...crossWins)
      await user.click(screen.getByRole('button', { name: 'Kijk terug' }))

      expect(screen.getByRole('region', { name: 'Spel terugkijken' })).toBeVisible()
      expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: leeg')
      await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
      expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')

      await user.click(screen.getByRole('button', { name: 'Terug' }))
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
      expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    })
  })

  it('does not offer a rematch while the game is on', async () => {
    await startGame()
    expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
  })

  describe('choosing the shapes', () => {
    /** The picker of a player, found by its label. */
    const picker = (player: 1 | 2) =>
      within(screen.getByRole('group', { name: `Speler ${player.toString()} kiest een vorm` }))

    it('comes first, with the cross for the first player and the circle for the second ready', () => {
      render(<Game />)
      expect(screen.queryByRole('group', { name: 'Speelveld' })).not.toBeInTheDocument()
      expect(picker(1).getByRole('button', { name: 'kruis' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(picker(2).getByRole('button', { name: 'cirkel' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it('plays with the shapes that were chosen, the first player starting', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.click(picker(1).getByRole('button', { name: 'hart' }))
      await user.click(picker(2).getByRole('button', { name: 'ster' }))
      await user.click(screen.getByRole('button', { name: 'Start' }))

      expect(screen.getByRole('status')).toHaveTextContent('Hart begint')
      await user.click(cell(1, 1))
      expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: hart')
      await user.click(cell(2, 2))
      expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: ster')
    })

    it('does not let both take the same shape, and says whose it is', () => {
      render(<Game />)
      expect(picker(2).getByRole('button', { name: 'kruis, van speler 1' })).toBeDisabled()
      expect(picker(1).getByRole('button', { name: 'cirkel, van speler 2' })).toBeDisabled()
    })

    it('frees a shape when its player takes another', async () => {
      render(<Game />)
      await userEvent.setup().click(picker(1).getByRole('button', { name: 'ster' }))
      expect(picker(2).getByRole('button', { name: 'kruis' })).toBeEnabled()
      expect(picker(2).getByRole('button', { name: 'ster, van speler 1' })).toBeDisabled()
    })

    it('keeps the shapes in a rematch, and lets the other player start', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.click(picker(1).getByRole('button', { name: 'hart' }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await tap(...crossWins)
      await user.click(screen.getByRole('button', { name: 'Nog een keer' }))
      expect(screen.getByRole('status')).toHaveTextContent('Cirkel begint')
      await user.click(cell(1, 1))
      expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: cirkel')
    })

    it('can be done again after a game, with a fresh start', async () => {
      await startGame()
      const user = await tap(...crossWins)
      await user.click(screen.getByRole('button', { name: 'Andere vormen' }))
      expect(picker(1).getByRole('button', { name: 'kruis' })).toBeVisible()
      await user.click(picker(1).getByRole('button', { name: 'plus' }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      expect(screen.getByRole('status')).toHaveTextContent('Plus begint')
    })
  })

  describe('choosing the field', () => {
    it('is classic unless another field is chosen, and the game says which field it is', async () => {
      await startGame()
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(9)
      expect(screen.getByText('3 × 3, drie op een rij')).toBeVisible()
    })

    it('plays on the field that was chosen, and wins with the row that goes with it', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Groter/ }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(49)
      expect(screen.getByText('7 × 7, vijf op een rij')).toBeVisible()

      // The cross plays the top row, the circle the second: five in a row wins, and four doesn't.
      for (const x of [1, 2, 3, 4]) await tap([1, x], [2, x])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis is aan de beurt')
      await tap([1, 5])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
      for (const x of [1, 2, 3, 4, 5]) expect(cell(1, x)).toHaveAttribute('data-winning')
    })

    /** A game on the 7 × 7 field that the cross has won, so that it is over. */
    async function wonOnTheBiggerField() {
      render(<Game />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Groter/ }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      for (const x of [1, 2, 3, 4]) await tap([1, x], [2, x])
      await tap([1, 5])
      return user
    }

    it('keeps the field in a rematch', async () => {
      const user = await wonOnTheBiggerField()
      await user.click(screen.getByRole('button', { name: 'Nog een keer' }))
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(49)
      expect(screen.getByText('7 × 7, vijf op een rij')).toBeVisible()
    })

    it('can be chosen again with "Andere vormen"', async () => {
      const user = await wonOnTheBiggerField()
      await user.click(screen.getByRole('button', { name: 'Andere vormen' }))
      expect(screen.getByRole('group', { name: 'Veld' })).toBeVisible()
      await user.click(screen.getByRole('button', { name: /Groot/ }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(225)
    })
  })

  describe('with more than two players', () => {
    const picker = (player: number) =>
      within(screen.getByRole('group', { name: `Speler ${player.toString()} kiest een vorm` }))

    it('has two players unless more are chosen, up to twelve, each with a picker', async () => {
      render(<Game />)
      expect(screen.getByLabelText('Aantal spelers')).toHaveValue('2')
      expect(screen.getAllByRole('group', { name: /kiest een vorm$/ })).toHaveLength(2)

      await userEvent.setup().selectOptions(screen.getByLabelText('Aantal spelers'), '12')
      expect(screen.getAllByRole('group', { name: /kiest een vorm$/ })).toHaveLength(12)
    })

    it('gives every new player the first shape that is free, and takes the last ones away again', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.click(picker(1).getByRole('button', { name: 'ster' }))
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '4')
      expect(picker(3).getByRole('button', { name: 'kruis' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(picker(4).getByRole('button', { name: 'vierkant' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '2')
      expect(screen.getAllByRole('group', { name: /kiest een vorm$/ })).toHaveLength(2)
      expect(picker(1).getByRole('button', { name: 'ster' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    })

    it('does not let two players have the same shape, and says whose it is', async () => {
      render(<Game />)
      await userEvent.setup().selectOptions(screen.getByLabelText('Aantal spelers'), '3')
      expect(picker(3).getByRole('button', { name: 'kruis, van speler 1' })).toBeDisabled()
      expect(picker(1).getByRole('button', { name: 'vierkant, van speler 3' })).toBeDisabled()
    })

    it('takes turns over all of them, and the first one who gets five in a row wins', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '3')
      await user.click(screen.getByRole('button', { name: /Groter/ }))
      await user.click(screen.getByRole('button', { name: 'Start' }))
      expect(screen.getByRole('status')).toHaveTextContent('Kruis begint')

      await tap([1, 1])
      expect(screen.getByRole('status')).toHaveTextContent('Cirkel is aan de beurt')
      await tap([2, 1])
      expect(screen.getByRole('status')).toHaveTextContent('Vierkant is aan de beurt')
      await tap([3, 1])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis is aan de beurt')

      // The square (third) plays the row 3, one cell at a time, while the others play elsewhere.
      for (const x of [2, 3, 4, 5]) await tap([1, x], [2, x], [3, x])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
    })

    it('lets the next player start every round', async () => {
      render(<Game />)
      const user = userEvent.setup()
      await user.selectOptions(screen.getByLabelText('Aantal spelers'), '3')
      await user.click(screen.getByRole('button', { name: 'Start' }))
      await tap([1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3])
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
      await user.click(screen.getByRole('button', { name: 'Nog een keer' }))
      expect(screen.getByRole('status')).toHaveTextContent('Cirkel begint')
      await tap([1, 1])
      await user.click(screen.getByRole('button', { name: 'Rij 2, kolom 1: leeg' }))
      expect(screen.getByRole('status')).toHaveTextContent('Kruis is aan de beurt')
    })
  })
})

describe('leaving a finished game on one screen', () => {
  it('goes to the start screen', async () => {
    window.history.replaceState(null, '', '/samen')
    const user = userEvent.setup()
    render(<Game />)
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.queryByRole('button', { name: 'Stoppen' })).not.toBeInTheDocument()

    // The cross wins on the top row.
    for (const [y, x] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ] as const) {
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(`^Rij ${y.toString()}, kolom ${x.toString()}`),
        }),
      )
    }
    await user.click(screen.getByRole('button', { name: 'Stoppen' }))
    expect(window.location.pathname).toBe('/')
  })
})

describe.each([
  {
    language: 'en',
    chooses: 'Player 1 chooses a shape',
    starts: 'Cross starts',
    empty: 'Row 2, column 2: empty',
    turn: "It is Circle's turn",
    won: 'Cross has won!',
    actions: ['Play again', 'Other shapes', 'Watch again', 'Leave'],
  },
  {
    language: 'fy',
    chooses: 'Spiler 1 kiest in foarm',
    starts: 'Krús begjint',
    empty: 'Rige 2, kolom 2: leech',
    turn: 'Sirkel is oan de beurt',
    won: 'Krús hat wûn!',
    actions: ['Noch ien kear', 'Oare foarmen', 'Sjoch werom', 'Ophâlde'],
  },
] as const satisfies readonly Record<string, unknown>[])(
  'the game on one screen in $language',
  ({ language, chooses, starts, empty, turn, won, actions }) => {
    it('chooses, plays and wins in the language, with no Dutch left on the screen', async () => {
      setLanguage(language)
      render(<Game />)
      expect(screen.getByRole('group', { name: chooses })).toBeVisible()
      expect(dutchLeaks(language)).toEqual([])
      await userEvent.click(screen.getByRole('button', { name: 'Start' }))

      expect(screen.getByRole('status')).toHaveTextContent(starts)
      expect(screen.getByRole('button', { name: new RegExp(`^${empty}$`) })).toBeVisible()
      const user = userEvent.setup()
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(language === 'en' ? '^Row 1, column 1' : '^Rige 1, kolom 1'),
        }),
      )
      expect(screen.getByRole('status')).toHaveTextContent(turn)
      expect(dutchLeaks(language)).toEqual([])

      for (const [y, x] of [
        [2, 1],
        [1, 2],
        [2, 2],
        [1, 3],
      ] as const) {
        const label =
          language === 'en'
            ? `^Row ${y.toString()}, column ${x.toString()}`
            : `^Rige ${y.toString()}, kolom ${x.toString()}`
        await user.click(screen.getByRole('button', { name: new RegExp(label) }))
      }
      expect(screen.getByRole('status')).toHaveTextContent(won)
      for (const name of actions) expect(screen.getByRole('button', { name })).toBeVisible()
      expect(dutchLeaks(language)).toEqual([])
    })
  },
)
