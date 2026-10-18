import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { FieldSettings } from '../../shared/room.ts'
import { FieldPicker } from './FieldPicker.tsx'

const CLASSIC: FieldSettings = { width: 3, height: 3, winLength: 3 }

/** The picker with a field of its own, as a screen holds it. */
function Holder({
  start = CLASSIC,
  seen,
}: {
  start?: FieldSettings
  seen?: (f: FieldSettings) => void
}) {
  const [field, setField] = useState(start)
  return (
    <FieldPicker
      value={field}
      onChange={(next) => {
        seen?.(next)
        setField(next)
      }}
    />
  )
}

const option = (name: RegExp) => screen.getByRole('option', { name })
/** The line that says what the field is, apart from the buttons with the same words on them. */
const summary = () => document.querySelector('.field-summary')

describe('FieldPicker', () => {
  it('offers the presets and a field of your own, the one in use pressed, and says what it is', () => {
    render(<Holder />)
    expect(screen.getByRole('group', { name: 'Veld' })).toBeVisible()
    expect(screen.getByRole('button', { name: /Klassiek/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Groter/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Groot/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Eigen veld/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(summary()).toHaveTextContent('3 × 3, drie op een rij')
  })

  it('takes a preset', async () => {
    const seen = vi.fn()
    render(<Holder seen={seen} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Groter/ }))
    expect(seen).toHaveBeenCalledWith({ width: 7, height: 7, winLength: 5 })
    expect(summary()).toHaveTextContent('7 × 7, vijf op een rij')
    expect(screen.getByRole('button', { name: /Groter/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no lists until you want a field of your own, and then only odd numbers', async () => {
    render(<Holder />)
    expect(screen.queryByLabelText('Breedte')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /Eigen veld/ }))
    const width = screen.getByLabelText('Breedte')
    const options = [...width.querySelectorAll('option')].map((o) => o.textContent)
    expect(options).toEqual(['3', '5', '7', '9', '11', '13', '15', '17', '19'])
    expect(screen.getByLabelText('Hoogte')).toBeVisible()
    expect(screen.getByLabelText('Op een rij')).toBeVisible()
  })

  it('changes the width and the height of your own field', async () => {
    const seen = vi.fn()
    render(<Holder seen={seen} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eigen veld/ }))
    await user.selectOptions(screen.getByLabelText('Breedte'), '9')
    await user.selectOptions(screen.getByLabelText('Hoogte'), '5')
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ width: 9, height: 5 }))
    expect(summary()).toHaveTextContent(/^9 × 5,/)
  })

  it('only offers a row that fits on the field, and brings it down when the field gets smaller', async () => {
    render(<Holder start={{ width: 9, height: 9, winLength: 9 }} />)
    const user = userEvent.setup()
    const rows = () =>
      [...screen.getByLabelText('Op een rij').querySelectorAll('option')].map((o) => o.value)
    expect(rows()).toEqual(['3', '5', '7', '9'])
    await user.selectOptions(screen.getByLabelText('Breedte'), '5')
    await user.selectOptions(screen.getByLabelText('Hoogte'), '5')
    expect(rows()).toEqual(['3', '5'])
    expect(screen.getByLabelText('Op een rij')).toHaveValue('5')
  })

  it('marks the row that makes a good game, and follows that suggestion while it is the one in use', async () => {
    render(<Holder />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eigen veld/ }))
    expect(option(/^3 \(tip\)$/)).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Breedte'), '15')
    await user.selectOptions(screen.getByLabelText('Hoogte'), '15')
    expect(screen.getByLabelText('Op een rij')).toHaveValue('5')
    expect(option(/^5 \(tip\)$/)).toBeVisible()
    await user.selectOptions(screen.getByLabelText('Breedte'), '19')
    await user.selectOptions(screen.getByLabelText('Hoogte'), '19')
    expect(screen.getByLabelText('Op een rij')).toHaveValue('7')
  })

  it('keeps a row somebody chose, says what the tip is and takes it on request', async () => {
    render(<Holder start={{ width: 11, height: 11, winLength: 5 }} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Eigen veld/ }))
    await user.selectOptions(screen.getByLabelText('Op een rij'), '9')
    expect(screen.getByText(/Tip: op dit veld speelt 5 op een rij het fijnst/)).toBeVisible()

    await user.selectOptions(screen.getByLabelText('Breedte'), '13')
    expect(screen.getByLabelText('Op een rij')).toHaveValue('9')

    await user.click(screen.getByRole('button', { name: 'Neem de tip over' }))
    expect(screen.getByLabelText('Op een rij')).toHaveValue('5')
    expect(screen.queryByText(/Tip: op dit veld/)).not.toBeInTheDocument()
  })

  it('starts with the lists open for a field that is no preset', () => {
    render(<Holder start={{ width: 9, height: 5, winLength: 5 }} />)
    expect(screen.getByLabelText('Breedte')).toHaveValue('9')
    expect(screen.getByRole('button', { name: /Eigen veld/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
