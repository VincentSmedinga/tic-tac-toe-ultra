import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { Replay } from './Replay.tsx'

const CLASSIC: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

// X wins on the top row in five moves.
const X_WINS: Move[] = [
  { player: 'X', x: 0, y: 0 },
  { player: 'O', x: 0, y: 1 },
  { player: 'X', x: 1, y: 0 },
  { player: 'O', x: 1, y: 1 },
  { player: 'X', x: 2, y: 0 },
]

const cell = (y: number, x: number) =>
  screen.getByRole('button', {
    name: new RegExp(`^Rij ${y.toString()}, kolom ${x.toString()}:`),
  })
/** Lets the clock run on in steps of one tick each, inside act, so that React shows each move. */
function advance(ms: number, ticks = 1) {
  for (let tick = 0; tick < ticks; tick++) {
    act(() => {
      vi.advanceTimersByTime(ms)
    })
  }
}
const status = () => screen.getByRole('status')

afterEach(() => {
  vi.useRealTimers()
})

describe('Replay', () => {
  it('starts at the empty field, with the first player', () => {
    render(<Replay config={CLASSIC} moves={X_WINS} />)
    expect(status()).toHaveTextContent('Het spel begint: Kruis is de eerste')
    expect(screen.getByText('Zet 0 van 5')).toBeInTheDocument()
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: leeg')
    expect(screen.getByRole('button', { name: 'Naar het begin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Een zet terug' })).toBeDisabled()
  })

  it('steps forward and back, saying whose move it was and marking the last one', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={X_WINS} />)

    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
    expect(cell(1, 1)).toHaveAttribute('data-last')
    expect(status()).toHaveTextContent('Kruis zet')

    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(cell(2, 1)).toHaveAccessibleName('Rij 2, kolom 1: cirkel')
    expect(cell(2, 1)).toHaveAttribute('data-last')
    expect(cell(1, 1)).not.toHaveAttribute('data-last')
    expect(status()).toHaveTextContent('Cirkel zet')
    expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Een zet terug' }))
    expect(cell(2, 1)).toHaveAccessibleName('Rij 2, kolom 1: leeg')
    expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
  })

  it('shows the winning line only at the end, with who won', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={X_WINS} />)

    await user.click(screen.getByRole('button', { name: 'Naar het einde' }))
    expect(status()).toHaveTextContent('Kruis heeft gewonnen!')
    for (const x of [1, 2, 3]) expect(cell(1, x)).toHaveAttribute('data-winning')
    expect(screen.getByRole('button', { name: 'Een zet verder' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Een zet terug' }))
    expect(cell(1, 3)).not.toHaveAttribute('data-winning')

    await user.click(screen.getByRole('button', { name: 'Naar het begin' }))
    expect(screen.getByText('Zet 0 van 5')).toBeInTheDocument()
  })

  it('says it is a draw at the end of a drawn game', async () => {
    const draw: Move[] = [
      { player: 'X', x: 0, y: 0 },
      { player: 'O', x: 1, y: 1 },
      { player: 'X', x: 2, y: 2 },
      { player: 'O', x: 1, y: 0 },
      { player: 'X', x: 1, y: 2 },
      { player: 'O', x: 0, y: 2 },
      { player: 'X', x: 2, y: 0 },
      { player: 'O', x: 2, y: 1 },
      { player: 'X', x: 0, y: 1 },
    ]
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={draw} />)
    await user.click(screen.getByRole('button', { name: 'Naar het einde' }))
    expect(status()).toHaveTextContent('Gelijkspel! Niemand heeft gewonnen.')
  })

  it('calls players by the name they typed', async () => {
    const user = userEvent.setup()
    render(
      <Replay config={CLASSIC} moves={X_WINS} players={[{ id: 'X', name: 'Anna' }, { id: 'O' }]} />,
    )
    await user.click(screen.getByRole('button', { name: 'Een zet verder' }))
    expect(status()).toHaveTextContent('Anna (kruis) zet')
    await user.click(screen.getByRole('button', { name: 'Naar het einde' }))
    expect(status()).toHaveTextContent('Anna (kruis) heeft gewonnen!')
  })

  it('works with the arrow keys, Home and End', async () => {
    const user = userEvent.setup()
    render(<Replay config={CLASSIC} moves={X_WINS} />)
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(screen.getByText('Zet 3 van 5')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()
    await user.keyboard('{End}')
    expect(screen.getByText('Zet 5 van 5')).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Zet 5 van 5')).toBeInTheDocument()
    await user.keyboard('{Home}{ArrowLeft}')
    expect(screen.getByText('Zet 0 van 5')).toBeInTheDocument()
  })

  it('has a slider, labelled with the move it is at', () => {
    render(<Replay config={CLASSIC} moves={X_WINS} />)
    const slider = screen.getByRole('slider', { name: 'Zet 0 van 5' })
    expect(slider).toHaveAttribute('max', '5')
    fireEvent.change(slider, { target: { value: '2' } })
    expect(screen.getByRole('slider', { name: 'Zet 2 van 5' })).toHaveValue('2')
    expect(cell(2, 1)).toHaveAccessibleName('Rij 2, kolom 1: cirkel')
  })

  it('has board cells that are no stops for the tab key', () => {
    render(<Replay config={CLASSIC} moves={X_WINS} />)
    expect(cell(1, 1)).toHaveAttribute('tabindex', '-1')
  })

  describe('playing on its own', () => {
    it('goes through the moves, pauses and stops at the end', () => {
      vi.useFakeTimers()
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      advance(800)
      expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
      advance(800)
      expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()

      act(() => {
        screen.getByRole('button', { name: 'Pauzeren' }).click()
      })
      advance(5000)
      expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()

      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      advance(800, 3)
      expect(screen.getByText('Zet 5 van 5')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Afspelen' })).toBeInTheDocument()
    })

    it('starts again from the beginning when it is played at the end', () => {
      vi.useFakeTimers()
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      act(() => {
        screen.getByRole('button', { name: 'Naar het einde' }).click()
      })
      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      expect(screen.getByText('Zet 0 van 5')).toBeInTheDocument()
      advance(800)
      expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
    })

    it('goes faster when asked', () => {
      vi.useFakeTimers()
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      act(() => {
        screen.getByRole('button', { name: 'Snel' }).click()
      })
      expect(screen.getByRole('button', { name: 'Snel' })).toHaveAttribute('aria-pressed', 'true')
      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      advance(300, 2)
      expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()
    })

    it('stops when a button or key moves it by hand', () => {
      vi.useFakeTimers()
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
      })
      advance(5000)
      expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
    })
  })

  it('stays at the end when the game it shows gets shorter', async () => {
    const { rerender } = render(<Replay config={CLASSIC} moves={X_WINS} />)
    await userEvent.click(screen.getByRole('button', { name: 'Naar het einde' }))
    rerender(<Replay config={CLASSIC} moves={X_WINS.slice(0, 3)} />)
    expect(screen.getByText('Zet 3 van 3')).toBeInTheDocument()
  })

  it('has nothing to play when no move was made', () => {
    render(<Replay config={CLASSIC} moves={[]} />)
    expect(screen.getByRole('button', { name: 'Afspelen' })).toBeDisabled()
    expect(screen.getByText('Zet 0 van 0')).toBeInTheDocument()
  })

  it('says so when the moves do not make a game', () => {
    render(<Replay config={CLASSIC} moves={[{ player: 'O', x: 0, y: 0 }]} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Dit spel kan niet worden teruggekeken.')
  })

  it('has a way back when it is asked to', async () => {
    const onClose = vi.fn()
    render(<Replay config={CLASSIC} moves={X_WINS} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Terug' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  describe('on a big field with more players', () => {
    // Twelve by twelve, five in a row, three players with the shapes of their id.
    const config: GameConfig = {
      width: 12,
      height: 12,
      winLength: 5,
      players: ['star', 'heart', 'fort'],
    }
    function played(count: number): Move[] {
      let game = createGame(config)
      const cells = Array.from({ length: 144 }, (_, index) => index)
      for (const index of cells.slice(0, count)) {
        const { status } = game
        if (status.kind !== 'playing') break
        const result = applyMove(game, {
          player: status.next,
          x: index % 12,
          y: Math.floor(index / 12),
        })
        if (!result.ok) throw new Error('bad test game')
        game = result.state
      }
      return [...game.moves]
    }

    it('shows every cell and steps through them', async () => {
      const moves = played(30)
      render(<Replay config={config} moves={moves} />)
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(144)
      expect(screen.getByRole('group', { name: 'Speelveld' })).toHaveAttribute('data-dense')

      await userEvent.click(screen.getByRole('button', { name: 'Naar het einde' }))
      expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: ster')
      expect(cell(1, 2)).toHaveAccessibleName('Rij 1, kolom 2: hart')
      expect(cell(1, 3)).toHaveAccessibleName('Rij 1, kolom 3: fort')
      expect(
        screen.getByText(`Zet ${moves.length.toString()} van ${moves.length.toString()}`),
      ).toBeInTheDocument()
    })
  })
})
