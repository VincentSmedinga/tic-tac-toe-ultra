import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Move } from '../../shared/game/index.ts'
import type { StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { OnlineGame } from './OnlineGame.tsx'
import type { StartedState } from './started.ts'

type Players = StateMessage['players']

/** The seats X and O have chosen the cross and the circle. */
const both: Players = [
  { id: 'X', name: 'Anna', shape: 'cross', connected: true },
  { id: 'O', shape: 'circle', connected: true },
]

/** The room as `you` (the seat X or O) sees it; the players of the game are the shapes. */
function stateOf(moves: Move[], you: string, players: Players = both, round = 0): StartedState {
  const config = roomConfig(round, ['cross', 'circle'])
  return {
    type: 'state',
    code: 'BCDF',
    you,
    field: { width: 3, height: 3, winLength: 3 },
    seats: 2,
    round,
    players,
    config: { ...config, players: [...config.players] },
    moves,
  }
}

const x = (col: number, row: number): Move => ({ player: 'cross', x: col, y: row })
const o = (col: number, row: number): Move => ({ player: 'circle', x: col, y: row })

/** The cross wins on the top row. */
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

  it('says how big the field is and how many in a row win, with the board of that size', () => {
    const state = stateOf([], 'X')
    const field = { width: 7, height: 5, winLength: 5 }
    render(
      <OnlineGame
        state={{ ...state, field, config: { ...state.config, ...field } }}
        send={vi.fn()}
      />,
    )
    expect(screen.getByText('7 × 5, vijf op een rij')).toBeVisible()
    expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(35)
  })

  describe('with three players', () => {
    const three = (moves: Move[], you: string): StartedState => {
      const config = { width: 7, height: 7, winLength: 5, players: ['cross', 'circle', 'star'] }
      return {
        ...stateOf([], you),
        field: { width: 7, height: 7, winLength: 5 },
        seats: 3,
        players: [
          { id: 'X', name: 'Anna', shape: 'cross', connected: true },
          { id: 'O', name: 'Bo', shape: 'circle', connected: true },
          { id: '3', shape: 'star', connected: true },
        ],
        config,
        moves,
      }
    }

    it('shows all of them, and whose turn it is by the name of the one who plays next', () => {
      render(<OnlineGame state={three([x(0, 0)], '3')} send={vi.fn()} />)
      expect(document.querySelectorAll('.players-row .player')).toHaveLength(3)
      expect(screen.getByText('Ster (jij)')).toBeVisible()
      expect(screen.getByText('Bo is aan de beurt')).toBeVisible()
    })

    it('lets the player whose turn it is play, and nobody else', async () => {
      const send = vi.fn()
      const user = userEvent.setup()
      const { rerender } = render(<OnlineGame state={three([x(0, 0), o(1, 0)], '3')} send={send} />)
      expect(screen.getByText('Jij bent aan de beurt')).toBeVisible()
      await user.click(cell(3, 3))
      expect(send).toHaveBeenCalledWith({ type: 'move', x: 2, y: 2 })

      send.mockClear()
      rerender(<OnlineGame state={three([x(0, 0), o(1, 0)], 'X')} send={send} />)
      await user.click(cell(3, 3))
      expect(send).not.toHaveBeenCalled()
    })

    it('tells the one who won, by name, to the others', () => {
      const star = (col: number, row: number): Move => ({ player: 'star', x: col, y: row })
      const moves = [
        x(0, 0),
        o(0, 1),
        star(0, 2),
        x(1, 0),
        o(1, 1),
        star(1, 2),
        x(2, 0),
        o(2, 1),
        star(2, 2),
        x(3, 0),
        o(3, 1),
        star(3, 2),
        x(6, 6),
        o(5, 5),
        star(4, 2),
      ]
      render(<OnlineGame state={three(moves, 'X')} send={vi.fn()} />)
      expect(screen.getByText('Ster heeft gewonnen!')).toBeVisible()
    })
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

    it('offers to leave once the game is over, after a question, and sends it', async () => {
      const send = vi.fn()
      const user = userEvent.setup()
      render(<OnlineGame state={stateOf(xWins, 'O')} send={send} />)
      await user.click(screen.getByRole('button', { name: 'Stoppen' }))
      expect(send).not.toHaveBeenCalled()
      expect(screen.getByRole('group', { name: /Stoppen\?$/ })).toBeVisible()
      expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Blijven' })).toHaveFocus()

      const question = screen.getByRole('group', { name: /Stoppen\?$/ })
      await user.click(within(question).getByRole('button', { name: 'Stoppen' }))
      expect(send).toHaveBeenCalledWith({ type: 'leave' })
    })

    it('keeps the buttons when the question is answered with Blijven, and does not ask again in the next round', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<OnlineGame state={stateOf(xWins, 'X')} send={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Stoppen' }))
      await user.click(screen.getByRole('button', { name: 'Blijven' }))
      expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'Stoppen' }))
      rerender(<OnlineGame state={stateOf([], 'X', both, 1)} send={vi.fn()} />)
      // In the next round the circle starts, and wins.
      const circleWins = xWins.map((move) => ({
        ...move,
        player: move.player === 'cross' ? 'circle' : 'cross',
      }))
      rerender(<OnlineGame state={stateOf(circleWins, 'X', both, 1)} send={vi.fn()} />)
      expect(screen.queryByRole('group', { name: /Stoppen\?$/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Stoppen' })).toBeVisible()
    })

    it('does not offer to leave while the game is on', () => {
      render(<OnlineGame state={stateOf([x(0, 0)], 'X')} send={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Stoppen' })).not.toBeInTheDocument()
    })

    it('cannot leave while the connection is down', () => {
      render(<OnlineGame state={stateOf(xWins, 'X')} send={vi.fn()} connected={false} />)
      expect(screen.getByRole('button', { name: 'Stoppen' })).toBeDisabled()
    })

    it('says who has left instead of who is away, and has no rematch when nobody is left to play', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', shape: 'cross', connected: true },
        { id: 'O', shape: 'circle', connected: true, left: true },
      ]
      render(<OnlineGame state={stateOf(xWins, 'X', players)} send={vi.fn()} />)
      expect(screen.getByText('Cirkel heeft het spel verlaten.')).toBeVisible()
      expect(screen.queryByText(/even weg/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Kijk terug' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Stoppen' })).toBeVisible()
    })

    it('names several who left in one sentence', () => {
      const config = { width: 7, height: 7, winLength: 5, players: ['cross', 'circle', 'star'] }
      const state: StartedState = {
        ...stateOf([], 'X'),
        field: { width: 7, height: 7, winLength: 5 },
        seats: 3,
        players: [
          { id: 'X', name: 'Anna', shape: 'cross', connected: true },
          { id: 'O', name: 'Bo', shape: 'circle', connected: false, left: true },
          { id: '3', name: 'Cas', shape: 'star', connected: false, left: true },
        ],
        config,
        moves: [],
      }
      render(<OnlineGame state={state} send={vi.fn()} />)
      expect(screen.getByText('Bo en Cas hebben het spel verlaten.')).toBeVisible()
    })

    it('leaves out of the players those who left before this round', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', shape: 'cross', connected: true },
        { id: 'O', shape: 'circle', connected: false, left: true },
        { id: '3', name: 'Cas', shape: 'star', connected: true },
      ]
      const config = { width: 7, height: 7, winLength: 5, players: ['cross', 'star'] }
      const state: StartedState = {
        ...stateOf([], 'X'),
        field: { width: 7, height: 7, winLength: 5 },
        round: 1,
        seats: 3,
        players,
        config,
        moves: [],
      }
      render(<OnlineGame state={state} send={vi.fn()} />)
      expect(screen.getByText('Cas')).toBeVisible()
      expect(screen.queryByText('Cirkel')).not.toBeInTheDocument()
      expect(screen.getByText('Cirkel heeft het spel verlaten.')).toBeVisible()
    })

    it('offers no rematch while the game is on', () => {
      render(<OnlineGame state={stateOf([x(0, 0)], 'X')} send={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Nog een keer' })).not.toBeInTheDocument()
    })
  })

  describe('when the other player is away', () => {
    it('says so, and that the game waits', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', shape: 'cross', connected: false },
        { id: 'O', shape: 'circle', connected: true },
      ]
      render(<OnlineGame state={stateOf([x(1, 1)], 'O', players)} send={vi.fn()} />)
      const note = screen.getByText(/Anna is even weg/)
      expect(note).toBeVisible()
      expect(within(note).queryByRole('button')).not.toBeInTheDocument()
    })

    it('says nothing about yourself when your own connection is the problem', () => {
      const players: Players = [
        { id: 'X', name: 'Anna', shape: 'cross', connected: false },
        { id: 'O', shape: 'circle', connected: true },
      ]
      render(<OnlineGame state={stateOf([], 'X', players)} send={vi.fn()} />)
      expect(screen.queryByText(/is even weg/)).not.toBeInTheDocument()
    })
  })

  it('says so when the moves are no game', () => {
    render(<OnlineGame state={stateOf([o(0, 0)], 'X')} send={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Er ging iets mis met het spel')
  })

  describe('looking back', () => {
    it('is offered after the game, with the names of the players', async () => {
      render(<OnlineGame state={stateOf(xWins, 'O')} send={vi.fn()} />)
      await userEvent.setup().click(screen.getByRole('button', { name: 'Kijk terug' }))

      expect(screen.getByRole('region', { name: 'Spel terugkijken' })).toBeVisible()
      await userEvent.setup().click(screen.getByRole('button', { name: 'Naar het einde' }))
      expect(
        within(screen.getByRole('status')).getByText('Anna (kruis) heeft gewonnen!'),
      ).toBeVisible()
    })

    it('is not offered while the game is on', () => {
      render(<OnlineGame state={stateOf([x(0, 0)], 'O')} send={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Kijk terug' })).not.toBeInTheDocument()
    })

    it('ends when a rematch starts', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<OnlineGame state={stateOf(xWins, 'O')} send={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: 'Kijk terug' }))
      rerender(<OnlineGame state={stateOf([], 'O', both, 1)} send={vi.fn()} />)
      expect(screen.queryByRole('region', { name: 'Spel terugkijken' })).not.toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Speelveld' })).toBeVisible()

      // And the next round, when it is over, shows its result: the old replay does not come back.
      const oWins = [o(0, 0), x(0, 1), o(1, 0), x(1, 1), o(2, 0)]
      rerender(<OnlineGame state={stateOf(oWins, 'O', both, 1)} send={vi.fn()} />)
      expect(screen.queryByRole('region', { name: 'Spel terugkijken' })).not.toBeInTheDocument()
      expect(screen.getByText('Je hebt gewonnen!')).toBeVisible()
      expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    })
  })

  describe('in the play mode', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/')
    })

    it('keeps what the room says about the connection, the players and whose turn it is', async () => {
      const user = userEvent.setup()
      render(
        <OnlineGame
          state={stateOf([x(0, 0)], 'O')}
          send={vi.fn()}
          banner={<p role="alert">Opnieuw verbinden…</p>}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Volledig scherm' }))
      const mode = screen.getByRole('region', { name: 'Online spel' })
      expect(mode).toHaveAttribute('data-play-mode')
      expect(within(mode).getByRole('alert')).toHaveTextContent('Opnieuw verbinden…')
      expect(within(mode).getByRole('status')).toHaveTextContent('Jij bent aan de beurt')
      expect(within(mode).getByText('Cirkel (jij)').closest('.player')).toHaveAttribute('data-turn')
      expect(within(mode).getByText('Anna').closest('.player')).not.toHaveAttribute('data-turn')
      // Only the player who is to move may play; the mode changes nothing of it.
      await user.click(screen.getByRole('button', { name: /^Rij 2, kolom 2:/ }))
      expect(window.history.state).toMatchObject({ playMode: true })
    })

    it('is a choice of this player, and says nothing to the room', async () => {
      const send = vi.fn()
      render(<OnlineGame state={stateOf([], 'X')} send={send} />)
      await userEvent.click(screen.getByRole('button', { name: 'Volledig scherm' }))
      expect(send).not.toHaveBeenCalled()
    })
  })
})
