import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppearanceSync } from './AppearanceSync.tsx'
import { savePreference } from './scheme.ts'

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

describe('AppearanceSync', () => {
  it('puts the look and the scheme of the system on the page, on any screen', () => {
    systemIs(true)
    render(<AppearanceSync />)
    expect(document.documentElement.dataset.look).toBe('drawn')
    expect(document.documentElement.dataset.scheme).toBe('dark')
  })

  it('follows the system when it changes, until somebody has picked light or dark', () => {
    const system = systemIs(false)
    render(<AppearanceSync />)
    expect(document.documentElement.dataset.scheme).toBe('light')
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('dark')
  })

  it('keeps the pick of a person, whatever the system does', () => {
    savePreference('light')
    const system = systemIs(false)
    render(<AppearanceSync />)
    system.change(true)
    expect(document.documentElement.dataset.scheme).toBe('light')
  })
})
