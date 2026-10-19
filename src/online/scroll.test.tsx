import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'

/** jsdom doesn't scroll: a page that is scrolled to a place, and that says so like a browser does. */
const CLOSE = 'Terug'
let scrollY = 0
function scrollTo(y: number) {
  scrollY = y
  window.dispatchEvent(new Event('scroll'))
}

let entries = 0
/** Opens an address as a new entry of the history, which the app knows by the id in its state. */
function openAt(path: string) {
  entries += 1
  window.history.pushState({ entry: `test-${entries.toString()}` }, '', path)
  render(<App />)
}

beforeEach(() => {
  scrollY = 0
  vi.spyOn(window, 'scrollTo').mockImplementation((_x: number, y: number) => {
    scrollTo(y)
  })
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY })
  window.history.pushState(null, '', '/')
})

describe('the page when a screen opens', () => {
  it('starts a screen at the top, with every link', async () => {
    openAt('/')
    scrollTo(900)
    await userEvent.setup().click(screen.getByRole('link', { name: 'Spellen' }))
    expect(window.location.pathname).toBe('/spellen')
    expect(scrollY).toBe(0)
  })

  it('starts the board at its top, after the Start button at the bottom of the picker', async () => {
    openAt('/samen')
    const user = userEvent.setup()
    scrollTo(1100)
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('group', { name: 'Speelveld' })).toBeVisible()
    expect(scrollY).toBe(0)
  })

  it('starts the picker at the top again with Andere vormen, and the replay at its top', async () => {
    openAt('/samen')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    // Three in a row: the cross wins the first row.
    for (const [row, col] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
      [1, 3],
    ] as const) {
      await user.click(
        screen.getByRole('button', {
          name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`),
        }),
      )
    }
    scrollTo(700)
    await user.click(screen.getByRole('button', { name: 'Kijk terug' }))
    expect(scrollY).toBe(0)
    scrollTo(500)
    await user.click(screen.getByRole('button', { name: CLOSE }))
    expect(scrollY).toBe(0)
    scrollTo(500)
    await user.click(screen.getByRole('button', { name: 'Andere vormen' }))
    expect(screen.getByRole('button', { name: 'Start' })).toBeVisible()
    expect(scrollY).toBe(0)
  })

  it('does not move the page while a game is played', async () => {
    openAt('/samen')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    scrollTo(180)
    await user.click(screen.getByRole('button', { name: /^Rij 2, kolom 2:/ }))
    await user.click(screen.getByRole('button', { name: /^Rij 1, kolom 1:/ }))
    expect(scrollY).toBe(180)
  })

  it('puts the page back where it was when back returns to a screen', async () => {
    openAt('/')
    const user = userEvent.setup()
    scrollTo(640)
    await user.click(screen.getByRole('link', { name: 'Samen op één scherm' }))
    expect(scrollY).toBe(0)
    scrollTo(75)

    act(() => {
      window.history.back()
    })
    expect(await screen.findByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
    await waitFor(() => {
      expect(scrollY).toBe(640)
    })

    // And forward again: the place on the screen that back left is remembered too.
    act(() => {
      window.history.forward()
    })
    expect(await screen.findByRole('button', { name: 'Start' })).toBeVisible()
    await waitFor(() => {
      expect(scrollY).toBe(75)
    })
  })

  it('does not take the page back when it is the full screen mode that back leaves', async () => {
    openAt('/')
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Samen op één scherm' }))
    await user.click(await screen.findByRole('button', { name: 'Start' }))
    scrollTo(30)
    window.history.pushState({ playMode: true }, '')
    act(() => {
      window.history.back()
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(scrollY).toBe(30)
  })
})
