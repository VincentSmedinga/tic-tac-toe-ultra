import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { MAX_ARRIVAL_MS } from '../motion/arrival.ts'
import { Replay, STEP_MS } from './Replay.tsx'

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

/** What is drawn on a button: the shape of its picture, which is all that tells two buttons apart. */
const pictureOf = (name: string) =>
  screen.getByRole('button', { name }).querySelector('path')?.getAttribute('d')

describe('Replay', () => {
  describe('the buttons', () => {
    it('draws every control differently, so that play is not taken for a step', () => {
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      const pictures = [
        'Naar het begin',
        'Een zet terug',
        'Afspelen',
        'Een zet verder',
        'Naar het einde',
      ].map(pictureOf)
      expect(new Set(pictures).size).toBe(5)
    })

    it('gives play a button of its own, apart from the steps', () => {
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      expect(screen.getByRole('button', { name: 'Afspelen' })).toHaveClass('replay-play')
      for (const name of ['Naar het begin', 'Een zet terug', 'Een zet verder', 'Naar het einde']) {
        expect(screen.getByRole('button', { name })).not.toHaveClass('replay-play')
      }
    })

    it('changes the picture and the label of play while it plays', async () => {
      const user = userEvent.setup()
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      const triangle = pictureOf('Afspelen')

      await user.click(screen.getByRole('button', { name: 'Afspelen' }))
      const bars = pictureOf('Pauzeren')
      expect(bars).toBeDefined()
      expect(bars).not.toBe(triangle)

      await user.click(screen.getByRole('button', { name: 'Pauzeren' }))
      expect(pictureOf('Afspelen')).toBe(triangle)
    })
  })

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
      advance(STEP_MS)
      expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
      advance(STEP_MS)
      expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()

      act(() => {
        screen.getByRole('button', { name: 'Pauzeren' }).click()
      })
      advance(5000)
      expect(screen.getByText('Zet 2 van 5')).toBeInTheDocument()

      act(() => {
        screen.getByRole('button', { name: 'Afspelen' }).click()
      })
      advance(STEP_MS, 3)
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
      advance(STEP_MS)
      expect(screen.getByText('Zet 1 van 5')).toBeInTheDocument()
    })

    it('has one speed, long enough for a shape to be written before the next step', () => {
      render(<Replay config={CLASSIC} moves={X_WINS} />)
      expect(screen.queryByRole('group', { name: 'Snelheid' })).toBeNull()
      expect(STEP_MS).toBeGreaterThanOrEqual(MAX_ARRIVAL_MS + 200)
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

describe.each([
  {
    language: 'en',
    label: 'Watching a game again',
    begins: 'The game begins: Anna (cross) goes first',
    controls: ['To the start', 'One move back', 'Play', 'One move forward', 'To the end'],
    pause: 'Pause',
    position: 'Move 0 of 5',
    moved: 'Move 2 of 5',
    plays: 'Bo (circle) plays',
    won: 'Anna (cross) has won!',
    close: 'Back',
    invalid: 'This game cannot be watched again.',
  },
  {
    language: 'fy',
    label: 'Spultsje werom sjen',
    begins: 'It spultsje begjint: Anna (krús) is de earste',
    controls: ['Nei it begjin', 'Ien set werom', 'Ofspylje', 'Ien set fierder', 'Nei it ein'],
    pause: 'Pauzearje',
    position: 'Set 0 fan 5',
    moved: 'Set 2 fan 5',
    plays: 'Bo (sirkel) sette',
    won: 'Anna (krús) hat wûn!',
    close: 'Werom',
    invalid: 'Dit spultsje kin net werom sjoen wurde.',
  },
] as const)('the replay in $language', (text) => {
  const { language } = text
  const players = [
    { id: 'X', name: 'Anna' },
    { id: 'O', name: 'Bo' },
  ]

  it('names the controls, the position and every step in the language', async () => {
    setLanguage(language)
    render(<Replay config={CLASSIC} moves={X_WINS} players={players} onClose={() => undefined} />)
    expect(screen.getByRole('region', { name: text.label })).toBeVisible()
    expect(status()).toHaveTextContent(text.begins)
    for (const name of text.controls) expect(screen.getByRole('button', { name })).toBeVisible()
    expect(screen.getByLabelText(text.position)).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: text.controls[3] }))
    await user.click(screen.getByRole('button', { name: text.controls[3] }))
    expect(screen.getByLabelText(text.moved)).toBeVisible()
    expect(status()).toHaveTextContent(text.plays)
    await user.click(screen.getByRole('button', { name: text.controls[4] }))
    expect(status()).toHaveTextContent(text.won)
    expect(screen.getByRole('button', { name: text.close })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })

  it('names play and pause, and says a game cannot be watched when it does not replay', () => {
    setLanguage(language)
    vi.useFakeTimers()
    const { unmount } = render(<Replay config={CLASSIC} moves={X_WINS} />)
    fireEvent.click(screen.getByRole('button', { name: text.controls[2] }))
    expect(screen.getByRole('button', { name: text.pause })).toBeVisible()
    unmount()

    render(<Replay config={CLASSIC} moves={[{ player: 'X', x: 9, y: 9 }]} />)
    expect(screen.getByRole('alert')).toHaveTextContent(text.invalid)
    expect(dutchLeaks(language)).toEqual([])
  })
})
