import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppearanceMenu } from './AppearanceMenu.tsx'

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

const open = async () => {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Uiterlijk' }))
  return user
}

afterEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.look
  delete document.documentElement.dataset.scheme
})

describe('AppearanceMenu', () => {
  it('puts the first look and the scheme of the system on the page, with the menu closed', () => {
    systemIs(true)
    render(<AppearanceMenu />)
    expect(document.documentElement.dataset.look).toBe('drawn')
    expect(document.documentElement.dataset.scheme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Uiterlijk' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('group', { name: 'Thema' })).not.toBeInTheDocument()
  })

  it('opens with the three themes and light and dark, the ones in use pressed', async () => {
    systemIs(false)
    render(<AppearanceMenu />)
    await open()
    const theme = screen.getByRole('group', { name: 'Thema' })
    expect(theme).toBeVisible()
    expect(screen.getByRole('button', { name: 'Getekend' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Speels' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Rustig' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Licht' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Donker' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Systeem' })).not.toBeInTheDocument()
  })

  it('changes the theme at once, and keeps it for this device', async () => {
    systemIs(false)
    render(<AppearanceMenu />)
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Rustig' }))
    expect(document.documentElement.dataset.look).toBe('calm')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.look')).toBe('calm')
    expect(screen.getByRole('button', { name: 'Rustig' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts with the theme that was kept', () => {
    systemIs(false)
    window.localStorage.setItem('tic-tac-toe-ultra.look', 'playful')
    render(<AppearanceMenu />)
    expect(document.documentElement.dataset.look).toBe('playful')
  })

  it('keeps dark when the system is light, and forgets the choice when it is the same as the system', async () => {
    systemIs(false)
    render(<AppearanceMenu />)
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Donker' }))
    expect(document.documentElement.dataset.scheme).toBe('dark')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: 'Licht' }))
    expect(document.documentElement.dataset.scheme).toBe('light')
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBeNull()
  })

  it('follows the system as long as nothing was chosen, and keeps a choice when the system changes', async () => {
    const system = systemIs(false)
    render(<AppearanceMenu />)
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('dark')

    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Licht' }))
    expect(window.localStorage.getItem('tic-tac-toe-ultra.scheme')).toBe('light')
    system.change(false)
    expect(document.documentElement.dataset.scheme).toBe('light')
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('light')
  })

  it('closes with Escape, and the focus goes back to its button', async () => {
    systemIs(false)
    render(<AppearanceMenu />)
    const user = await open()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group', { name: 'Thema' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uiterlijk' })).toHaveFocus()
  })

  it('closes when something else on the page is tapped', async () => {
    systemIs(false)
    render(
      <>
        <p>Ergens anders</p>
        <AppearanceMenu />
      </>,
    )
    const user = await open()
    await user.click(screen.getByText('Ergens anders'))
    expect(screen.queryByRole('group', { name: 'Thema' })).not.toBeInTheDocument()
  })

  it('closes with its own button as well', async () => {
    systemIs(false)
    render(<AppearanceMenu />)
    const user = await open()
    await user.click(screen.getByRole('button', { name: 'Uiterlijk' }))
    expect(screen.queryByRole('group', { name: 'Thema' })).not.toBeInTheDocument()
  })
})
