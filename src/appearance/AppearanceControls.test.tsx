import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppearanceControls } from './AppearanceControls.tsx'

/** The system says dark or light, and can change its mind while the page is open. */
function systemIs(dark: boolean) {
  let listener: (() => void) | undefined
  let current = dark
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        get matches() {
          return current
        },
        media: query,
        addEventListener: (_type: string, callback: () => void) => {
          listener = callback
        },
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
  return {
    change(next: boolean) {
      current = next
      act(() => listener?.())
    },
  }
}

afterEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.look
  delete document.documentElement.dataset.scheme
})

describe('AppearanceControls', () => {
  it('puts the first look and the scheme of the system on the page', () => {
    systemIs(true)
    render(<AppearanceControls />)
    expect(document.documentElement.dataset.look).toBe('drawn')
    expect(document.documentElement.dataset.scheme).toBe('dark')
  })

  it('is always there: the three themes and light and dark, the ones in use pressed', () => {
    systemIs(false)
    render(<AppearanceControls />)
    expect(screen.getByRole('region', { name: 'Uiterlijk' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Thema' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Getekend' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Speels' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Rustig' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Licht' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Donker' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Systeem' })).not.toBeInTheDocument()
  })

  it('changes the theme at once, and keeps it for this device', async () => {
    systemIs(false)
    render(<AppearanceControls />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Rustig' }))
    expect(document.documentElement.dataset.look).toBe('calm')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.look')).toBe('calm')
    expect(screen.getByRole('button', { name: 'Rustig' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts with the theme that was kept', () => {
    systemIs(false)
    window.localStorage.setItem('tic-tac-toe-ultra.look', 'playful')
    render(<AppearanceControls />)
    expect(document.documentElement.dataset.look).toBe('playful')
  })

  it('keeps dark when the system is light, and forgets the choice when it is the same as the system', async () => {
    systemIs(false)
    render(<AppearanceControls />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Donker' }))
    expect(document.documentElement.dataset.scheme).toBe('dark')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Licht' }))
    expect(document.documentElement.dataset.scheme).toBe('light')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBeNull()
  })

  it('follows the system as long as nothing was chosen, and keeps a choice when the system changes', async () => {
    const system = systemIs(false)
    render(<AppearanceControls />)
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('dark')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Licht' }))
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBe('light')
    system.change(false)
    expect(document.documentElement.dataset.scheme).toBe('light')
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('light')
  })
})
