import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'
import { STORAGE_KEY } from './i18n/language.ts'
import { getLanguage, resetLanguage, setLanguage } from './i18n/store.ts'
import { dutchLeaks } from './i18n/testing.ts'

function openAt(path: string) {
  window.history.pushState(null, '', path)
  render(<App />)
}

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

describe('App', () => {
  it('shows the name of the game with the start screen', () => {
    openAt('/')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Boter, Kaas en Eieren Ultra' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  })

  it('plays on one screen at /samen, with a way back', async () => {
    openAt('/samen')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByRole('group', { name: 'Speelveld' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Terug naar het begin' }))
    expect(window.location.pathname).toBe('/')
    expect(await screen.findByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  })

  it('shows the way back and no title on a screen with a game, and the places on every other', () => {
    openAt('/samen')
    expect(document.querySelector('.app')).toHaveAttribute('data-screen', 'game')
    expect(screen.getByRole('link', { name: 'Terug naar het begin' })).toHaveAttribute('href', '/')
    cleanup()
    openAt('/spellen')
    expect(document.querySelector('.app')).toHaveAttribute('data-screen', 'page')
    expect(screen.queryByRole('link', { name: 'Terug naar het begin' })).not.toBeInTheDocument()
  })

  it('goes from the start screen to the game on one screen without loading the page', async () => {
    openAt('/')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Samen op één scherm' }))
    expect(window.location.pathname).toBe('/samen')
    expect(await screen.findByRole('button', { name: 'Start' })).toBeVisible()
  })

  it('says so on the start screen when the address of a room is no code', () => {
    openAt('/kamer/abcd')
    expect(screen.getByRole('alert')).toHaveTextContent('Dat is geen geldige code')
    expect(screen.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  })

  it('follows the back button of the browser', async () => {
    openAt('/samen')
    window.history.pushState(null, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(await screen.findByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  })

  it('has the four places on every screen but the page has no footer', async () => {
    openAt('/')
    const user = userEvent.setup()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    const menu = () => within(screen.getByRole('navigation', { name: 'Hoofdmenu' }))
    expect(menu().getByRole('link', { name: 'Start' })).toHaveAttribute('aria-current', 'page')
    await user.click(menu().getByRole('link', { name: 'Spellen' }))
    expect(window.location.pathname).toBe('/spellen')
    expect(await screen.findByRole('heading', { name: 'Gespeelde spellen' })).toBeVisible()
    expect(menu().getByRole('link', { name: 'Spellen' })).toHaveAttribute('aria-current', 'page')
    await user.click(menu().getByRole('link', { name: 'Start' }))
    expect(await screen.findByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  })

  it('opens the statistics from the menu', async () => {
    openAt('/')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Statistieken' }))
    expect(window.location.pathname).toBe('/statistieken')
    expect(await screen.findByRole('heading', { name: 'Statistieken', level: 2 })).toBeVisible()
  })

  it('opens the settings from the menu, with the choices that were in the footer', async () => {
    openAt('/')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Instellingen' }))
    expect(window.location.pathname).toBe('/instellingen')
    expect(await screen.findByRole('heading', { name: 'Instellingen', level: 2 })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Uiterlijk' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Taal' })).toBeVisible()
  })

  it('no longer has the gallery of all shapes on the start screen', () => {
    openAt('/')
    expect(screen.queryByText('Alle vormen')).not.toBeInTheDocument()
  })
})

describe('the language', () => {
  const group = (name: string) => screen.getByRole('group', { name })

  it('is Dutch for a browser in Dutch, and for one in a language we do not have', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'ja'])
    openAt('/')
    expect(screen.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
    expect(document.documentElement.lang).toBe('nl')
  })

  it('follows the browser the first time: English for an English browser', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB', 'nl'])
    openAt('/')
    expect(screen.getByRole('button', { name: 'New room' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Tic-Tac-Toe Ultra' })).toBeVisible()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Tic-Tac-Toe Ultra')
    expect(dutchLeaks('en')).toEqual([])
  })

  it('is offered in the settings next to the theme, each language in its own, with the one in use pressed', () => {
    openAt('/instellingen')
    const picker = within(group('Taal'))
    expect(picker.getByRole('button', { name: 'Nederlands' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(picker.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    expect(picker.getByRole('button', { name: 'English' })).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('group', { name: 'Thema' })).toBeVisible()
  })

  it('follows a browser in Frisian, and offers it next to the other two', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fy-NL', 'nl'])
    openAt('/')
    expect(screen.getByRole('button', { name: 'Nije keamer' })).toBeVisible()
    await userEvent.setup().click(screen.getByRole('link', { name: 'Ynstellingen' }))
    expect(within(group('Taal')).getByRole('button', { name: 'Frysk' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('can be chosen in Frisian, which is kept', async () => {
    window.history.pushState(null, '', '/instellingen')
    const { unmount } = render(<App />)
    const user = userEvent.setup()
    await user.click(within(group('Taal')).getByRole('button', { name: 'Frysk' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Ynstellingen' })).toBeVisible()
    expect(document.documentElement.lang).toBe('fy')
    expect(document.title).toBe('Bûter, Tsiis en Aaien Ultra')
    expect(screen.getByRole('group', { name: 'Taal' })).toBeVisible()
    expect(dutchLeaks('fy')).toEqual([])
    unmount()

    // Loaded again, the chosen language is still the page's.
    resetLanguage()
    window.history.pushState(null, '', '/')
    render(<App />)
    expect(screen.getByRole('button', { name: 'Nije keamer' })).toBeVisible()
  })

  it('changes every text at once, the title and lang of the page, and is kept', async () => {
    openAt('/instellingen')
    await userEvent.setup().click(within(group('Taal')).getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Settings' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toHaveTextContent('Games')
    expect(screen.getByRole('region', { name: 'Appearance' })).toBeVisible()
    expect(group('Language')).toBeVisible()
    expect(document.documentElement.lang).toBe('en')
    expect(document.title).toBe('Tic-Tac-Toe Ultra')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect(dutchLeaks('en')).toEqual([])

    resetLanguage()
    expect(getLanguage()).toBe('en')
  })

  it('has the menu, in English, on every screen', async () => {
    setLanguage('en')
    openAt('/spellen')
    expect(await screen.findByRole('heading', { name: 'Games played' })).toBeVisible()
    const menu = within(screen.getByRole('navigation', { name: 'Main menu' }))
    expect(menu.getByRole('link', { name: 'Home' })).toBeVisible()
    expect(menu.getByRole('link', { name: 'Games' })).toHaveAttribute('aria-current', 'page')
    expect(menu.getByRole('link', { name: 'Stats' })).toBeVisible()
    expect(menu.getByRole('link', { name: 'Settings' })).toBeVisible()
    expect(dutchLeaks('en')).toEqual([])
  })

  it('has the menu in Frisian too', () => {
    setLanguage('fy')
    openAt('/statistieken')
    const menu = within(screen.getByRole('navigation', { name: 'Haadmenu' }))
    expect(menu.getByRole('link', { name: 'Begjin' })).toBeVisible()
    expect(menu.getByRole('link', { name: 'Spultsjes' })).toBeVisible()
    expect(menu.getByRole('link', { name: 'Statistiken' })).toHaveAttribute('aria-current', 'page')
    expect(menu.getByRole('link', { name: 'Ynstellingen' })).toBeVisible()
    expect(dutchLeaks('fy')).toEqual([])
  })
})
