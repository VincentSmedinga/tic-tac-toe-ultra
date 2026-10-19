import { readFileSync } from 'node:fs'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Route } from '../online/route.ts'
import { MainNav } from './MainNav.tsx'
import { placeOf } from './place.ts'

const menu = () => within(screen.getByRole('navigation', { name: 'Hoofdmenu' }))

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

describe('MainNav', () => {
  it('is a navigation with the four places, as links', () => {
    render(<MainNav route={{ name: 'start' }} />)
    expect(menu().getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/')
    expect(menu().getByRole('link', { name: 'Spellen' })).toHaveAttribute('href', '/spellen')
    expect(menu().getByRole('link', { name: 'Statistieken' })).toHaveAttribute(
      'href',
      '/statistieken',
    )
    expect(menu().getByRole('link', { name: 'Instellingen' })).toHaveAttribute(
      'href',
      '/instellingen',
    )
  })

  it('marks the place you are in, and only that one', () => {
    const { rerender } = render(<MainNav route={{ name: 'stats' }} />)
    expect(menu().getAllByRole('link', { current: 'page' })).toHaveLength(1)
    expect(menu().getByRole('link', { name: 'Statistieken' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    rerender(<MainNav route={{ name: 'settings' }} />)
    expect(menu().getByRole('link', { name: 'Instellingen' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('takes a game that was played, and its replay, for the games', () => {
    expect(placeOf({ name: 'games' })).toBe('games')
    expect(placeOf({ name: 'game', id: 'abcdefghijklmnop' })).toBe('games')
  })

  it('has no place for a game that is being played', () => {
    const routes: Route[] = [{ name: 'local' }, { name: 'room', code: 'BCDF' }]
    for (const route of routes) expect(placeOf(route)).toBeNull()
    render(<MainNav route={{ name: 'local' }} />)
    expect(menu().queryAllByRole('link', { current: 'page' })).toHaveLength(0)
  })

  it('goes there without loading the page again', async () => {
    render(<MainNav route={{ name: 'start' }} />)
    await userEvent.setup().click(menu().getByRole('link', { name: 'Instellingen' }))
    expect(window.location.pathname).toBe('/instellingen')
  })
})

describe('the CSS of the menu', () => {
  const css = readFileSync('src/layout/MainNav.css', 'utf8')
  const header = readFileSync('src/layout/SiteHeader.css', 'utf8')

  it('is part of the page and never fixed or sticky at the edge of the screen: iOS draws a bar behind it (issue #77)', () => {
    expect(css).not.toMatch(/position:\s*(fixed|sticky)/)
    expect(header).not.toMatch(/position:\s*(fixed|sticky)/)
  })

  it('leaves out the bar on a phone while a game is on the screen, and puts it under the title from 48 rem', () => {
    expect(css).toMatch(
      /max-width: 47\.99rem\)[^@]*\.app\[data-screen='game'\] \.main-nav \{\s*display: none/,
    )
    expect(css).toMatch(/min-width: 48rem\)\s*\{\s*\.main-nav \{\s*order: 0/)
  })
})
