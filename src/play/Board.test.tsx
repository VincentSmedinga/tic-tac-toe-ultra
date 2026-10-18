import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { GameConfig, GameState } from '../../shared/game/index.ts'
import { arrivalPlan } from '../motion/arrival.ts'
import { resetAnimations, setAnimations } from '../motion/preference.ts'
import { strokeLengths } from '../shapes/length.ts'
import { Board } from './Board.tsx'
import gameCss from './Game.css?raw'
import { boardLines } from './lines.ts'

const board = (config: Partial<GameConfig> = {}) =>
  createGame({ width: 3, height: 3, winLength: 3, players: ['cross', 'circle'], ...config })

describe('Board', () => {
  it('has a cell for every place on the field, whatever its shape', () => {
    render(<Board game={board({ width: 7, height: 5, winLength: 5 })} onPlay={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(35)
    expect(screen.getByRole('button', { name: 'Rij 5, kolom 7: leeg' })).toBeVisible()
  })

  it('tells its frame how many columns and rows there are, so that it can size the cells', () => {
    const { container } = render(
      <Board game={board({ width: 9, height: 5, winLength: 5 })} onPlay={vi.fn()} />,
    )
    const frame = container.querySelector<HTMLElement>('.board-frame')
    expect(frame?.style.getPropertyValue('--columns')).toBe('9')
    expect(frame?.style.getPropertyValue('--rows')).toBe('5')
  })

  describe('the lines', () => {
    const linesOf = (container: HTMLElement, axis: string) =>
      [...container.querySelectorAll<SVGElement>(`.board-line[data-axis="${axis}"]`)].map((line) =>
        Number(line.dataset.after),
      )

    it('are between the cells and none around the field', () => {
      const { container } = render(
        <Board game={board({ width: 7, height: 5, winLength: 5 })} onPlay={vi.fn()} />,
      )
      // One line between every two columns and every two rows: six down and four across.
      expect(linesOf(container, 'vertical')).toEqual([1, 2, 3, 4, 5, 6])
      expect(linesOf(container, 'horizontal')).toEqual([1, 2, 3, 4])
      // A picture in units of one cell, so a line at 3 is after the third column whatever the size.
      expect(container.querySelector('.board-lines')).toHaveAttribute('viewBox', '0 0 7 5')
      const straight = container.querySelector('.board-line[data-axis="vertical"][data-after="3"]')
      expect(straight?.querySelector('.board-line-straight')).toHaveAttribute('d', 'M3 0 L3 5')
    })

    it('make a 3 × 3 two lines across and two down', () => {
      const { container } = render(<Board game={board()} onPlay={vi.fn()} />)
      expect(linesOf(container, 'vertical')).toHaveLength(2)
      expect(linesOf(container, 'horizontal')).toHaveLength(2)
    })

    it('are not part of the field: hidden from assistive technology, behind the cells', () => {
      const { container } = render(<Board game={board()} onPlay={vi.fn()} />)
      const picture = container.querySelector('.board-lines')
      expect(picture).toHaveAttribute('aria-hidden', 'true')
      expect(picture?.querySelectorAll('button')).toHaveLength(0)
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(9)
    })

    it('have a straight and a hand-drawn version of every line, each line its own', () => {
      const lines = boardLines(5, 5)
      expect(lines).toHaveLength(8)
      expect(new Set(lines.map((line) => line.hand)).size).toBe(8)
      expect(new Set(lines.map((line) => line.weight)).size).toBeGreaterThan(1)
      // The same field is drawn the same way every time, so nothing flickers on a new render.
      expect(boardLines(5, 5)).toEqual(lines)
      for (const { weight } of lines) expect(weight).toBeGreaterThanOrEqual(0.85)
    })

    it('keep every cell of a bigger field the size of a finger: cells have no gap or border', () => {
      // The declarations of the rule that starts with this selector, up to its closing brace.
      const rule = (selector: string) => {
        const start = gameCss.indexOf(`\n${selector} {`)
        return start < 0 ? '' : gameCss.slice(start, gameCss.indexOf('}', start))
      }
      expect(rule('.board')).toContain('display: grid')
      expect(rule('.board')).not.toMatch(/\bgap\b/)
      expect(rule('.board-frame')).not.toMatch(/--gap/)
      expect(rule('.cell')).toMatch(/border:\s*0/)
      expect(rule('.cell')).toMatch(/aspect-ratio:\s*1/)
      expect(rule('.board-frame')).toMatch(/--cell-min:\s*2\.75rem/)
    })

    it('are no reason to leave out the field of a wide board: it keeps all cells, in one frame', () => {
      const { container } = render(
        <Board game={board({ width: 11, height: 11, winLength: 5 })} onPlay={vi.fn()} />,
      )
      expect(container.querySelector('.board-frame')).not.toHaveAttribute('data-dense')
      expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(121)
    })
  })

  describe('what is on a cell', () => {
    const tapped = (...moves: [number, number][]) => {
      let game = board()
      for (const [x, y] of moves) {
        if (game.status.kind !== 'playing') throw new Error('bad test game')
        const result = applyMove(game, { player: game.status.next, x, y })
        if (!result.ok) throw new Error('bad test game')
        game = result.state
      }
      return game
    }

    it('marks every cell of a winning line, a corner once, by a patch behind the shape', () => {
      // Cross wins the top row and the left column at once with the corner.
      const game = tapped([1, 0], [1, 1], [2, 0], [2, 1], [0, 1], [2, 2], [0, 2], [1, 2], [0, 0])
      expect(game.status.kind).toBe('won')
      render(<Board game={game} onPlay={vi.fn()} />)
      const winning = screen
        .getAllByRole('button', { name: /^Rij / })
        .filter((cell) => cell.hasAttribute('data-winning'))
      expect(winning).toHaveLength(5)
      expect(gameCss).toMatch(
        /\.cell\[data-winning\]::before \{[^}]*background: color-mix\([^}]*var\(--win\)/,
      )
      // The patch of a cell keeps away from the lines: it is smaller than the cell.
      expect(gameCss).toMatch(/\.cell::before \{[^}]*inset: calc\(var\(--line-width\) \/ 2 \+ /)
    })

    it('tells the last move, a taken cell and an empty one apart by more than colour', () => {
      render(<Board game={tapped([1, 1])} onPlay={vi.fn()} lastMove={{ x: 1, y: 1 }} />)
      const taken = screen.getByRole('button', { name: 'Rij 2, kolom 2: kruis' })
      const empty = screen.getByRole('button', { name: 'Rij 1, kolom 1: leeg' })
      expect(taken).toHaveAttribute('data-last')
      expect(taken.querySelector('svg')).not.toBeNull()
      expect(empty.querySelector('svg')).toBeNull()
      expect(empty).not.toHaveAttribute('data-last')
      expect(taken).toHaveAttribute('aria-disabled', 'true')
      expect(empty).toHaveAttribute('aria-disabled', 'false')
    })
  })

  it('is one tab stop on a field of 361 cells, with a hint for the keyboard', () => {
    render(<Board game={board({ width: 19, height: 19, winLength: 9 })} onPlay={vi.fn()} />)
    const stops = screen
      .getAllByRole('button', { name: /^Rij / })
      .filter((cell) => cell.getAttribute('tabindex') === '0')
    expect(stops).toHaveLength(1)
    expect(screen.getByRole('group', { name: 'Speelveld' })).toHaveAccessibleDescription(
      'Ga met de pijltjestoetsen over het veld.',
    )
  })

  it('moves over a big field with the arrow keys, Home and End, row by row', async () => {
    render(<Board game={board({ width: 9, height: 9, winLength: 5 })} onPlay={vi.fn()} />)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('button', { name: 'Rij 3, kolom 4: leeg' })).toHaveFocus()
    await user.keyboard('{End}')
    expect(screen.getByRole('button', { name: 'Rij 3, kolom 9: leeg' })).toHaveFocus()
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(screen.getByRole('button', { name: 'Rij 4, kolom 9: leeg' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('button', { name: 'Rij 4, kolom 1: leeg' })).toHaveFocus()
  })

  it('plays the cell the keyboard is on, with Enter', async () => {
    const onPlay = vi.fn()
    render(<Board game={board({ width: 5, height: 5, winLength: 5 })} onPlay={onPlay} />)
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard('{ArrowDown}{ArrowRight}{Enter}')
    expect(onPlay).toHaveBeenCalledWith({ x: 1, y: 1 })
  })

  it('is no tab stop at all when it is only looked at', () => {
    render(<Board game={board()} onPlay={vi.fn()} focusable={false} />)
    for (const cell of screen.getAllByRole('button', { name: /^Rij / })) {
      expect(cell).toHaveAttribute('tabindex', '-1')
    }
  })

  it('remembers the cell that was tapped as the one the keyboard is on', async () => {
    render(<Board game={board({ width: 5, height: 5, winLength: 5 })} onPlay={vi.fn()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rij 3, kolom 3: leeg' }))
    expect(screen.getByRole('button', { name: 'Rij 3, kolom 3: leeg' })).toHaveAttribute(
      'tabindex',
      '0',
    )
  })
})

describe('writing a shape', () => {
  const originalMatchMedia = window.matchMedia.bind(window)
  const play = (game: GameState, x: number, y: number) => {
    if (game.status.kind !== 'playing') throw new Error('the game is over')
    const result = applyMove(game, { player: game.status.next, x, y })
    if (!result.ok) throw new Error(result.error)
    return result.state
  }
  const cell = (name: string) => screen.getByRole('button', { name })

  /** Every `animate` call, with the element it was made on. */
  const animated = () => {
    const calls: { element: Element; cancel: ReturnType<typeof vi.fn> }[] = []
    stubAnimate(function (this: Element) {
      const cancel = vi.fn()
      calls.push({ element: this, cancel })
      return { cancel }
    })
    return calls
  }

  // jsdom has no Web Animations API: a browser's `animate` is stood in for.
  const stubAnimate = (implementation: (this: Element, frames: unknown) => unknown) => {
    Object.defineProperty(Element.prototype, 'animate', {
      value: implementation,
      configurable: true,
      writable: true,
    })
  }

  afterEach(() => {
    vi.restoreAllMocks()
    window.matchMedia = originalMatchMedia
    Reflect.deleteProperty(Element.prototype, 'animate')
    window.localStorage.clear()
    resetAnimations()
  })

  it('shows the variant that was picked for the move, on the shape that was placed', () => {
    const empty = board()
    const { rerender } = render(<Board game={empty} onPlay={vi.fn()} seed={42} />)
    const first = play(empty, 1, 1)
    rerender(<Board game={first} onPlay={vi.fn()} seed={42} />)
    const kruis = cell('Rij 2, kolom 2: kruis').querySelector('svg')
    expect(kruis).toHaveAttribute(
      'data-arrival',
      arrivalPlan(42, 0, strokeLengths('cross')).variant,
    )

    const second = play(first, 0, 0)
    rerender(<Board game={second} onPlay={vi.fn()} seed={42} />)
    // The move before keeps its variant; the new shape is written in a variant of its own.
    expect(cell('Rij 2, kolom 2: kruis').querySelector('svg')).toHaveAttribute(
      'data-arrival',
      arrivalPlan(42, 0, strokeLengths('cross')).variant,
    )
    const cirkel = cell('Rij 1, kolom 1: cirkel').querySelector('svg')
    expect(cirkel).toHaveAttribute(
      'data-arrival',
      arrivalPlan(42, 1, strokeLengths('circle')).variant,
    )
    expect(cirkel?.getAttribute('data-arrival')).not.toBe(kruis?.getAttribute('data-arrival'))
  })

  it('writes the strokes of the new shape, and lets them finish when the next move is played', () => {
    const calls = animated()
    const empty = board()
    const { rerender } = render(<Board game={empty} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(0)

    const first = play(empty, 1, 1)
    rerender(<Board game={first} onPlay={vi.fn()} seed={1} />)
    // A cross has two strokes, and they are the ones of the cell that was played.
    expect(calls).toHaveLength(2)
    const svg = cell('Rij 2, kolom 2: kruis').querySelector('svg')
    for (const { element } of calls) expect(element.closest('svg')).toBe(svg)

    rerender(<Board game={play(first, 0, 0)} onPlay={vi.fn()} seed={1} />)
    // The new shape (a circle: one stroke) is written too, and the cross is not cut off or begun again.
    expect(calls).toHaveLength(3)
    for (const { cancel } of calls) expect(cancel).not.toHaveBeenCalled()
  })

  it('stops the writing of shapes that are taken off the field', () => {
    const calls = animated()
    const first = play(board(), 1, 1)
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={first} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    for (const { cancel } of calls) expect(cancel).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-arrival]')).toBeNull()
  })

  it('writes nothing on a board that is first shown with moves on it, or one that is emptied', () => {
    const calls = animated()
    const played = play(play(board(), 0, 0), 1, 1)
    const { rerender } = render(<Board game={played} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(0)
    rerender(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(0)
    expect(document.querySelector('[data-arrival]')).toBeNull()
  })

  it('writes nothing when several shapes arrive at once, as when a replay jumps ahead', () => {
    const calls = animated()
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={play(play(board(), 0, 0), 1, 1)} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(0)
  })

  it('does not write again when it is drawn again without a new move', () => {
    const calls = animated()
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    const first = play(board(), 1, 1)
    rerender(<Board game={first} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={{ ...first, cells: [...first.cells] }} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(2)
    for (const { cancel } of calls) expect(cancel).not.toHaveBeenCalled()
  })

  it('does not hold the game up: the next cell can be played while the shape is written', async () => {
    animated()
    const onPlay = vi.fn()
    const { rerender } = render(<Board game={board()} onPlay={onPlay} seed={1} />)
    rerender(<Board game={play(board(), 1, 1)} onPlay={onPlay} seed={1} />)
    await userEvent.setup().click(cell('Rij 1, kolom 1: leeg'))
    expect(onPlay).toHaveBeenCalledWith({ x: 0, y: 0 })
  })

  it('only fades the shape in when the system asks for less motion', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    )
    const keyframes: unknown[] = []
    stubAnimate((frames) => {
      keyframes.push(frames)
      return { cancel: vi.fn() }
    })
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={play(board(), 1, 1)} onPlay={vi.fn()} seed={1} />)
    expect(keyframes).toEqual([[{ opacity: 0 }, { opacity: 1 }]])
  })

  it('writes nothing, and stops what is going on, when the animations are switched off', () => {
    const calls = animated()
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={play(board(), 1, 1)} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(2)
    act(() => {
      setAnimations(false)
    })
    for (const { cancel } of calls) expect(cancel).toHaveBeenCalled()
    expect(document.querySelector('[data-arrival]')).toBeNull()
    rerender(<Board game={play(play(board(), 1, 1), 0, 0)} onPlay={vi.fn()} seed={1} />)
    expect(calls).toHaveLength(2)
  })

  it('leaves the status line and the names of the cells as they are', () => {
    animated()
    const { rerender } = render(<Board game={board()} onPlay={vi.fn()} seed={1} />)
    rerender(<Board game={play(board(), 1, 1)} onPlay={vi.fn()} seed={1} />)
    const svg = cell('Rij 2, kolom 2: kruis').querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByRole('button', { name: /^Rij / })).toHaveLength(9)
  })
})
