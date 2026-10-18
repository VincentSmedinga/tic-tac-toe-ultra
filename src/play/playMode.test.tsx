import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { dutchLeaks } from '../i18n/testing.ts'
import { Game } from './Game.tsx'

/** A page like the app's: something before the game, something after it, and the game in the middle. */
function page() {
  return render(
    <>
      <header>
        <a href="/">Kop</a>
      </header>
      <main>
        <Game />
      </main>
      <footer>
        <a href="/spellen">Voet</a>
      </footer>
    </>,
  )
}

async function startGame() {
  const view = page()
  await userEvent.click(screen.getByRole('button', { name: 'Start' }))
  return view
}

const opener = () => screen.getByRole('button', { name: 'Volledig scherm' })
const closer = () => screen.getByRole('button', { name: 'Sluiten' })
const cell = (y: number, x: number) =>
  screen.getByRole('button', { name: new RegExp(`^Rij ${y.toString()}, kolom ${x.toString()}:`) })
const layer = () => screen.getByRole('region', { name: /Ultra$/ })

/** Cross wins on the top row. */
const crossWins = [
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
  [1, 3],
] as const

async function tap(...cells: readonly (readonly [number, number])[]) {
  for (const [y, x] of cells) await userEvent.click(cell(y, x))
}

/** What the browser does for the back button: leave the entry, tell the page. */
async function back() {
  act(() => {
    window.history.back()
  })
  await waitFor(() => {
    expect(window.history.state).not.toMatchObject({ playMode: true })
  })
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.documentElement.removeAttribute('data-play-mode')
})

describe('the play mode', () => {
  it('has a button that is pressed once the mode is on, and turns into Sluiten', async () => {
    await startGame()
    expect(opener()).toHaveAttribute('aria-pressed', 'false')
    expect(layer()).not.toHaveAttribute('data-play-mode')
    await userEvent.click(opener())
    expect(closer()).toHaveAttribute('aria-pressed', 'true')
    expect(layer()).toHaveAttribute('data-play-mode')
    expect(document.documentElement).toHaveAttribute('data-play-mode')
    expect(window.history.state).toMatchObject({ playMode: true })
  })

  it('puts the rest of the page out of reach while it is on, and gives it back afterwards', async () => {
    await startGame()
    const header = document.querySelector('header')
    const footer = document.querySelector('footer')
    expect(header).not.toHaveAttribute('inert')
    await userEvent.click(opener())
    expect(header).toHaveAttribute('inert')
    expect(footer).toHaveAttribute('inert')
    // The game itself is not.
    expect(layer()).not.toHaveAttribute('inert')
    expect(layer().closest('[inert]')).toBeNull()
    await userEvent.click(closer())
    await waitFor(() => {
      expect(header).not.toHaveAttribute('inert')
    })
    expect(footer).not.toHaveAttribute('inert')
    expect(document.documentElement).not.toHaveAttribute('data-play-mode')
  })

  it('closes with the button, and the history is as it was', async () => {
    await startGame()
    await userEvent.click(opener())
    await userEvent.click(closer())
    await waitFor(() => {
      expect(opener()).toHaveAttribute('aria-pressed', 'false')
    })
    expect(window.history.state).toBeNull()
  })

  it('closes with Escape', async () => {
    await startGame()
    await userEvent.click(opener())
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(opener()).toHaveAttribute('aria-pressed', 'false')
    })
    expect(layer()).not.toHaveAttribute('data-play-mode')
  })

  it('closes with the back button, and the game stays', async () => {
    await startGame()
    await tap([1, 1])
    await userEvent.click(opener())
    await back()
    await waitFor(() => {
      expect(opener()).toHaveAttribute('aria-pressed', 'false')
    })
    // Back closed the mode and not the game: the move is still there.
    expect(cell(1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
  })

  it('opens and closes with F on the board', async () => {
    await startGame()
    await userEvent.click(cell(2, 2))
    await userEvent.keyboard('f')
    expect(layer()).toHaveAttribute('data-play-mode')
    await userEvent.keyboard('F')
    await waitFor(() => {
      expect(layer()).not.toHaveAttribute('data-play-mode')
    })
  })

  it('leaves F alone when the focus is not on the board', async () => {
    await startGame()
    opener().focus()
    await userEvent.keyboard('f')
    expect(layer()).not.toHaveAttribute('data-play-mode')
  })

  it('moves the focus into the mode, to the board, and back to the button', async () => {
    await startGame()
    opener().focus()
    await userEvent.click(opener())
    expect(cell(1, 1)).toHaveFocus()
    await userEvent.click(closer())
    await waitFor(() => {
      expect(opener()).toHaveFocus()
    })
  })

  it('keeps the cell the keyboard was on, when the focus is on the board already', async () => {
    await startGame()
    const user = userEvent.setup()
    await user.click(cell(1, 1))
    await user.keyboard('{ArrowDown}')
    expect(cell(2, 1)).toHaveFocus()
    await user.keyboard('f')
    expect(cell(2, 1)).toHaveFocus()
  })

  it('shows who is to play, the players and, at the end of the game, what comes next', async () => {
    await startGame()
    await userEvent.click(opener())
    expect(screen.getByRole('status')).toHaveTextContent('Kruis begint')
    expect(screen.getByText('Kruis', { selector: '.player span' })).toBeVisible()
    await tap([1, 1])
    expect(
      screen.getByText('Cirkel', { selector: '.player span' }).closest('.player'),
    ).toHaveAttribute('data-turn')
    await tap([2, 1], [1, 2], [2, 2], [1, 3])
    expect(screen.getByRole('button', { name: 'Nog een keer' })).toBeVisible()
    expect(layer()).toHaveAttribute('data-play-mode')
  })

  it('ends when the game is left, and takes its entry in the history with it', async () => {
    const { unmount } = await startGame()
    await userEvent.click(opener())
    const spy = vi.spyOn(window.history, 'back')
    unmount()
    expect(spy).toHaveBeenCalledOnce()
    expect(document.documentElement).not.toHaveAttribute('data-play-mode')
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
  })

  it('ends when the replay opens, which is a screen of its own', async () => {
    await startGame()
    await userEvent.click(opener())
    await tap(...crossWins)
    await userEvent.click(screen.getByRole('button', { name: 'Kijk terug' }))
    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-play-mode')
    })
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
  })

  it('asks the browser for the real full screen where it has one, and ends the mode with it', async () => {
    const request = vi.fn(() => Promise.resolve())
    Object.assign(document, { fullscreenEnabled: true })
    HTMLElement.prototype.requestFullscreen = request
    try {
      await startGame()
      await userEvent.click(opener())
      expect(request).toHaveBeenCalledOnce()
      // The browser's own Escape ends the full screen, and tells the page; then the mode ends too.
      act(() => {
        document.dispatchEvent(new Event('fullscreenchange'))
      })
      await waitFor(() => {
        expect(opener()).toHaveAttribute('aria-pressed', 'false')
      })
    } finally {
      Reflect.deleteProperty(document, 'fullscreenEnabled')
      Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen')
    }
  })

  it('is the mode alone where the browser has no full screen, and pretends nothing', async () => {
    await startGame()
    await userEvent.click(opener())
    expect(layer()).toHaveAttribute('data-play-mode')
    expect(document.fullscreenElement).toBeFalsy()
  })

  it('keeps the screen awake while it is on, where the browser can', async () => {
    const release = vi.fn(() => Promise.resolve())
    const request = vi.fn(() => Promise.resolve({ released: false, release }))
    Object.assign(navigator, { wakeLock: { request } })
    try {
      await startGame()
      await userEvent.click(opener())
      expect(request).toHaveBeenCalledWith('screen')
      await userEvent.click(closer())
      await waitFor(() => {
        expect(release).toHaveBeenCalled()
      })
    } finally {
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
  })

  it('has no button in an installed app, which has no chrome to hide', async () => {
    const original = window.matchMedia.bind(window)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    try {
      await startGame()
      expect(screen.queryByRole('button', { name: 'Volledig scherm' })).not.toBeInTheDocument()
      await userEvent.click(cell(2, 2))
      await userEvent.keyboard('f')
      expect(layer()).not.toHaveAttribute('data-play-mode')
    } finally {
      vi.stubGlobal('matchMedia', original)
    }
  })

  it.each([
    ['en', 'Full screen', 'Close'],
    ['fy', 'Folslein skerm', 'Slute'],
  ] as const)('is in %s too, with no Dutch left on the screen', async (language, open, close) => {
    setLanguage(language)
    page()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: open }))
    expect(screen.getByRole('button', { name: close })).toHaveAttribute('aria-pressed', 'true')
    expect(dutchLeaks(language, layer())).toEqual([])
  })
})
