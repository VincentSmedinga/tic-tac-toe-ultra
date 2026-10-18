import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Game } from './Game.tsx'

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
  it('starts with an empty field and the cross to play', () => {
    render(<Game />)
    expect(screen.getAllByRole('button')).toHaveLength(9)
    expect(screen.getByRole('status')).toHaveTextContent('Kruis begint')
    expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: leeg')
  })

  it('lets the players take turns', async () => {
    render(<Game />)
    await tap([1, 1])
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
    expect(screen.getByRole('status')).toHaveTextContent('Cirkel is aan de beurt')

    await tap([2, 2])
    expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
    expect(screen.getByRole('status')).toHaveTextContent('Kruis is aan de beurt')
  })

  it('ignores a tap on a cell that is taken', async () => {
    render(<Game />)
    await tap([1, 1], [1, 1])
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
    expect(screen.getByRole('status')).toHaveTextContent('Cirkel is aan de beurt')
  })

  it('can be played with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Game />)
    cell(1, 2).focus()
    await user.keyboard('{Enter}')
    expect(cell(1, 2)).toHaveAccessibleName('Rij 1, kolom 2: kruis')
    await user.keyboard('{Tab}{ }')
    expect(cell(1, 3)).toHaveAccessibleName('Rij 1, kolom 3: cirkel')
  })

  describe('when someone wins', () => {
    it('says who won and marks the winning line', async () => {
      render(<Game />)
      await tap(...crossWins)
      expect(screen.getByRole('status')).toHaveTextContent('Kruis heeft gewonnen!')
      for (const x of [1, 2, 3]) expect(cell(1, x)).toHaveAttribute('data-winning')
      expect(cell(2, 1)).not.toHaveAttribute('data-winning')
    })

    it('marks every line the last move completes, each cell once: five cells for a row and a column', async () => {
      render(<Game />)
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
      render(<Game />)
      await tap(...crossWins, [3, 3])
      expect(cell(3, 3)).toHaveAccessibleName('Rij 3, kolom 3: leeg')
      expect(cell(3, 3)).toHaveAttribute('aria-disabled', 'true')
    })

    it('lets the other player start the next round after "Nog een keer"', async () => {
      render(<Game />)
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
    render(<Game />)
    await tap([1, 1], [1, 2], [1, 3], [2, 2], [2, 1], [2, 3], [3, 2], [3, 1], [3, 3])
    expect(screen.getByRole('status')).toHaveTextContent('Gelijkspel!')
    expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    for (const name of screen.getAllByRole('button', { name: /^Rij/ })) {
      expect(name).not.toHaveAttribute('data-winning')
    }
  })

  describe('looking back', () => {
    it('is not offered while the game is on', () => {
      render(<Game />)
      expect(screen.queryByRole('button', { name: 'Kijk terug' })).not.toBeInTheDocument()
    })

    it('replays the game just played, and goes back to the end of it', async () => {
      render(<Game />)
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

  it('does not offer a rematch while the game is on', () => {
    render(<Game />)
    expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
  })
})
