import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createGame } from '../../shared/game/index.ts'
import type { GameConfig } from '../../shared/game/index.ts'
import { Board } from './Board.tsx'

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

  it('thins the lines of a wide field, and not of a small one', () => {
    const wide = render(
      <Board game={board({ width: 11, height: 11, winLength: 5 })} onPlay={vi.fn()} />,
    )
    expect(wide.container.querySelector('.board-frame')).toHaveAttribute('data-dense')
    wide.unmount()
    const small = render(<Board game={board()} onPlay={vi.fn()} />)
    expect(small.container.querySelector('.board-frame')).not.toHaveAttribute('data-dense')
    small.unmount()
    const five = render(
      <Board game={board({ width: 5, height: 5, winLength: 5 })} onPlay={vi.fn()} />,
    )
    expect(five.container.querySelector('.board-frame')).not.toHaveAttribute('data-dense')
    five.unmount()
    const seven = render(
      <Board game={board({ width: 7, height: 7, winLength: 5 })} onPlay={vi.fn()} />,
    )
    expect(seven.container.querySelector('.board-frame')).toHaveAttribute('data-dense')
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
