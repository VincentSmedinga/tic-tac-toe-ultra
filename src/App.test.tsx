import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App.tsx'

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
    expect(screen.getByRole('heading', { level: 1, name: 'Boter, kaas en eieren' })).toBeVisible()
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

  it('goes from the start screen to the game on one screen without loading the page', async () => {
    openAt('/')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Samen spelen' }))
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
})
