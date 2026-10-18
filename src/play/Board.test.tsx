import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { GameConfig } from '../../shared/game/index.ts'
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

    it('marks every cell of a winning line, a corner once, by a ring and not by colour alone', () => {
      // Cross wins the top row and the left column at once with the corner.
      const game = tapped([1, 0], [1, 1], [2, 0], [2, 1], [0, 1], [2, 2], [0, 2], [1, 2], [0, 0])
      expect(game.status.kind).toBe('won')
      render(<Board game={game} onPlay={vi.fn()} />)
      const winning = screen
        .getAllByRole('button', { name: /^Rij / })
        .filter((cell) => cell.hasAttribute('data-winning'))
      expect(winning).toHaveLength(5)
      expect(gameCss).toMatch(/\.cell\[data-winning\] \{[^}]*box-shadow: inset 0 0 0/)
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
