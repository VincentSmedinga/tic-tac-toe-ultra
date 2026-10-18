import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Move } from '../../shared/game/index.ts'
import type { StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { OnlineGame } from './OnlineGame.tsx'

type Players = StateMessage['players']

const both: Players = [
  { id: 'X', name: 'Anna', connected: true },
  { id: 'O', connected: true },
]

function stateOf(moves: Move[], you: string, players: Players = both, round = 0): StateMessage {
  const config = roomConfig(round)
  return {
    type: 'state',
    code: 'BCDF',
    you,
    round,
    players,
    config: { ...config, players: [...config.players] },
    moves,
  }
}

const x = (col: number, row: number): Move => ({ player: 'X', x: col, y: row })
const o = (col: number, row: number): Move => ({ player: 'O', x: col, y: row })

/** X wins on the top row. */
const xWins = [x(0, 0), o(0, 1), x(1, 0), o(1, 1), x(2, 0)]

function cell(row: number, col: number) {
  return screen.getByRole('button', {
    name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`),
  })
}

describe('OnlineGame', () => {
  it('shows both players, with the names, and which one is you', () => {
    render(<OnlineGame state={stateOf([], 'O')} send={vi.fn()} />)
    expect(screen.getByText('Anna')).toBeVisible()
    expect(screen.getByText('Cirkel (jij)')).toBeVisible()
  })

  describe('whose turn it is', () => {
    it('says "Jij begint" to the player who starts, and lets them play', async () => {
      const send = vi.fn()
      render(<OnlineGame state={stateOf([], 'X')} send={send} />)
      expect(screen.getByText('Jij begint')).toBeVisible()

      await userEvent.setup().click(cell(2, 3))
      expect(send).toHaveBeenCalledWith({ type: 'move', x: 2, y: 1 })
    })

    it('tells the other player who begins, and does not let them play', async () => {
      const send = vi.fn()
      render(<OnlineGame state={stateOf([], 'O')} send={send} />)
      expect(screen.getByText('Anna begint')).toBeVisible()
      expect(cell(1, 1)).toHaveAttribute('aria-disabled', 'true')

      await userEvent.setup().click(cell(1, 1))
      expect(send).not.toHaveBeenCalled()
    })

    it('goes on with "aan de beurt" once a move is made, for both', () => {
      const moves = [x(1, 1)]
      const { unmount } = render(<OnlineGame state={stateOf(moves, 'O')} send={vi.fn()} />)
      expect(screen.getByText('Jij bent aan de beurt')).toBeVisible()
      expect(cell(2, 2)).toHaveAccessibleName('Rij 2, kolom 2: kruis')
      unmount()

      render(<OnlineGame state={stateOf(moves, 'X')} send={vi.fn()} />)
      expect(screen.getByText('Cirkel is aan de beurt')).toBeVisible()
    })

    it('has the other player start after a rematch', () => {
      render(<OnlineGame state={stateOf([], 'O', both, 1)} send={vi.fn()} />)
      expect(screen.getByText('Jij begint')).toBeVisible()
    })
  })

  describe('the end of a game', () => {
    it('tells the winner, marks the line and offers a rematch that is sent', async () => {
      const send = vi.fn()
      render(<OnlineGame state={stateOf(xWins, 'X')} send={send} />)
      expect(screen.getByText('Je hebt gewonnen!')).toBeVisible()
      for (const col of [1, 2, 3]) expect(cell(1, col)).toHaveAttribute('data-winning')

      await userEvent.setup().click(screen.getByRole('button', { name: 'Nog een keer' }))
      expect(send).toHaveBeenCalledWith({ type: 'rematch' })
    })

    it('tells the loser who won, by name', () => {
      render(<OnlineGame state={stateOf(xWins, 'O')} send={vi.fn()} />)
      expect(screen.getByText('Anna heeft gewonnen!')).toBeVisible()
    })

    it('takes no more moves after the game', async () => {
      const send = vi.fn()
      render(<OnlineGame state={stateOf(xWins, 'O')} send={send} />)
      await userEvent.setup().click(cell(3, 3))
      expect(send).not.toHaveBeenCalled()
    })

    it('declares a draw', () => {
      const draw = [x(0, 0), o(1, 0), x(2, 0), o(1, 1), x(0, 1), o(2, 1), x(1, 2), o(0, 2), x(2, 2)]
      render(<OnlineGame state={stateOf(draw, 'X')} send={vi.fn()} />)
      expect(screen.getByText('Gelijkspel! Niemand heeft gewonnen.')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    })

    it('offers no rematch while the game is on', () => {
      render(<OnlineGame state={stateOf([x(0, 0)], 'X')} send={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
    })
  })

  describe('when the other player is away', () => {
    it('says so, and that the game waits', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', connected: false },
        { id: 'O', connected: true },
      ]
      render(<OnlineGame state={stateOf([x(1, 1)], 'O', players)} send={vi.fn()} />)
      const note = screen.getByText(/Anna is even weg/)
      expect(note).toBeVisible()
      expect(within(note).queryByRole('button')).not.toBeInTheDocument()
    })

    it('says nothing about yourself when your own connection is the problem', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', connected: false },
        { id: 'O', connected: true },
      ]
      render(<OnlineGame state={stateOf([], 'X', players)} send={vi.fn()} />)
      expect(screen.queryByText(/is even weg/)).not.toBeInTheDocument()
    })
  })

  it('says so when the moves are no game', () => {
    render(<OnlineGame state={stateOf([o(0, 0)], 'X')} send={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Er ging iets mis met het spel')
  })
})
