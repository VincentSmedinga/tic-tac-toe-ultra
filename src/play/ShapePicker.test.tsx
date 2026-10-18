import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ShapePicker } from './ShapePicker.tsx'

describe('ShapePicker', () => {
  it('offers all twelve shapes, by their Dutch names, in a group with the label', () => {
    render(<ShapePicker label="Kies je vorm" value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Kies je vorm' })).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(12)
    expect(screen.getByRole('button', { name: 'kruis' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'goudstaaf' })).toBeVisible()
  })

  it('passes on the shape that is tapped', async () => {
    const onChange = vi.fn()
    render(<ShapePicker label="Kies" value={null} onChange={onChange} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'hart' }))
    expect(onChange).toHaveBeenCalledWith('heart')
  })

  it('marks the shape that is chosen, and only that one', () => {
    render(<ShapePicker label="Kies" value="star" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'ster' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'hart' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('does not let a shape be tapped that somebody else has, and says who has it', async () => {
    const onChange = vi.fn()
    render(<ShapePicker label="Kies" value={null} taken={{ cross: 'Bo' }} onChange={onChange} />)
    const taken = screen.getByRole('button', { name: 'kruis, van Bo' })
    expect(taken).toBeDisabled()
    expect(taken).toHaveTextContent('Bo')
    await userEvent.setup().click(taken)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works with the keyboard', async () => {
    const onChange = vi.fn()
    render(<ShapePicker label="Kies" value={null} onChange={onChange} />)
    await userEvent.setup().tab()
    await userEvent.setup().keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('cross')
  })
})
