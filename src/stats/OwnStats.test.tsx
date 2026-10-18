import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OwnStats as Own } from '../../shared/protocol.ts'
import type { OwnStatsApi } from './api.ts'
import { OwnStats } from './OwnStats.tsx'

const TOKEN = 'abcdefghijklmnopqrstuvwx'
const OWN: Own = {
  games: 12,
  won: 7,
  lost: 3,
  drawn: 2,
  unknown: 0,
  favourite: { shape: 'heart', games: 5 },
}

const apiWith = (stats: Own): OwnStatsApi => ({ getOwnStats: vi.fn(() => Promise.resolve(stats)) })

describe('OwnStats', () => {
  it('says how many games this browser played and how they ended, and asks with its token', async () => {
    const api = apiWith(OWN)
    render(<OwnStats token={TOKEN} api={api} />)
    const region = await screen.findByRole('region', { name: 'Jouw statistieken' })
    expect(region).toHaveTextContent(
      'Je hebt 12 spellen gespeeld: 7 gewonnen, 3 verloren en 2 gelijk.',
    )
    expect(api.getOwnStats).toHaveBeenCalledWith(TOKEN)
  })

  it('names the shape it plays most', async () => {
    render(<OwnStats token={TOKEN} api={apiWith(OWN)} />)
    expect(await screen.findByText('Je favoriete vorm is hart (5 spellen).')).toBeVisible()
  })

  it('says one game in the singular', async () => {
    const one = {
      ...OWN,
      games: 1,
      won: 1,
      lost: 0,
      drawn: 0,
      favourite: { shape: 'cross', games: 1 },
    } as const
    render(<OwnStats token={TOKEN} api={apiWith(one)} />)
    expect(await screen.findByText(/Je hebt 1 spel gespeeld: 1 gewonnen/)).toBeVisible()
    expect(screen.getByText(/favoriete vorm is kruis \(1 spel\)/)).toBeVisible()
  })

  it('counts games of which it is not known whether they were won as played only', async () => {
    render(<OwnStats token={TOKEN} api={apiWith({ ...OWN, games: 14, unknown: 2 })} />)
    expect(await screen.findByText(/Van 2 spellen is niet meer bekend of je won/)).toBeVisible()
  })

  it('leaves out the results when none of the games is known', async () => {
    render(
      <OwnStats
        token={TOKEN}
        api={apiWith({ ...OWN, games: 2, won: 0, lost: 0, drawn: 0, unknown: 2, favourite: null })}
      />,
    )
    expect(await screen.findByText('Je hebt 2 spellen gespeeld.')).toBeVisible()
    expect(screen.queryByText(/gewonnen/)).not.toBeInTheDocument()
  })

  it('shows nothing when there are no games, or while it is fetching, or when it fails', async () => {
    const none = { ...OWN, games: 0, won: 0, lost: 0, drawn: 0, favourite: null }
    const { unmount } = render(<OwnStats token={TOKEN} api={apiWith(none)} />)
    await vi.waitFor(() => {
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })
    unmount()

    render(
      <OwnStats token={TOKEN} api={{ getOwnStats: () => Promise.reject(new Error('offline')) }} />,
    )
    await Promise.resolve()
    expect(screen.queryByRole('region')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
