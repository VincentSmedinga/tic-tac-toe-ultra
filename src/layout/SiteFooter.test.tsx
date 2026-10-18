import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SiteFooter } from './SiteFooter.tsx'

const links = () => within(screen.getByRole('navigation', { name: 'Naar een ander scherm' }))

beforeEach(() => {
  window.history.pushState(null, '', '/')
})

describe('SiteFooter', () => {
  it('is the bottom of the page, with the ways to go elsewhere and how the game looks', () => {
    render(<SiteFooter route={{ name: 'local' }} />)
    expect(screen.getByRole('contentinfo')).toBeVisible()
    expect(links().getByRole('link', { name: 'Terug naar het begin' })).toHaveAttribute('href', '/')
    expect(links().getByRole('link', { name: 'Gespeelde spellen' })).toHaveAttribute(
      'href',
      '/spellen',
    )
    expect(links().getByRole('link', { name: 'Statistieken' })).toHaveAttribute(
      'href',
      '/statistieken',
    )
    expect(screen.getByRole('region', { name: 'Uiterlijk' })).toBeVisible()
  })

  it('leaves out the link to the screen you are on', () => {
    const { rerender } = render(<SiteFooter route={{ name: 'start' }} />)
    expect(links().queryByRole('link', { name: 'Terug naar het begin' })).not.toBeInTheDocument()
    expect(links().getByRole('link', { name: 'Gespeelde spellen' })).toBeVisible()

    rerender(<SiteFooter route={{ name: 'games' }} />)
    expect(links().getByRole('link', { name: 'Terug naar het begin' })).toBeVisible()
    expect(links().queryByRole('link', { name: 'Gespeelde spellen' })).not.toBeInTheDocument()
  })

  it('leaves out the link to the statistics on the statistics', () => {
    render(<SiteFooter route={{ name: 'stats' }} />)
    expect(links().queryByRole('link', { name: 'Statistieken' })).not.toBeInTheDocument()
    expect(links().getByRole('link', { name: 'Gespeelde spellen' })).toBeVisible()
  })

  it('takes you there without loading the page again', async () => {
    render(<SiteFooter route={{ name: 'room', code: 'BCDF' }} />)
    await userEvent.setup().click(links().getByRole('link', { name: 'Gespeelde spellen' }))
    expect(window.location.pathname).toBe('/spellen')
  })
})
