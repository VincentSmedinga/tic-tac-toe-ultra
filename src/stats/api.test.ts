import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeStats } from '../../shared/stats.ts'
import { statsApi } from './api.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('asking for the statistics', () => {
  it('asks /api/stats and reads what comes back', async () => {
    const stats = computeStats([], 0)
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(stats))
    expect(await statsApi.getStats()).toEqual(stats)
    expect(fetch).toHaveBeenCalledWith('/api/stats')
  })

  it('fails when the server does', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 500 }))
    await expect(statsApi.getStats()).rejects.toThrow('500')
  })

  it('fails on an answer that is no statistics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ games: 'many' }))
    await expect(statsApi.getStats()).rejects.toThrow()
  })
})

describe('asking for the statistics of this browser', () => {
  const own = { games: 1, won: 1, lost: 0, drawn: 0, unknown: 0, favourite: null }

  it('asks /api/stats/mine with the token in a header, never in the address', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(own))
    expect(await statsApi.getOwnStats('abcdefghijklmnopqrstuvwx')).toEqual(own)
    expect(fetch).toHaveBeenCalledWith('/api/stats/mine', {
      headers: { 'X-Player-Token': 'abcdefghijklmnopqrstuvwx' },
    })
  })

  it('fails when the server does, and on an answer that is no statistics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({}, { status: 401 }))
    await expect(statsApi.getOwnStats('x')).rejects.toThrow('401')
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ games: 'many' }))
    await expect(statsApi.getOwnStats('x')).rejects.toThrow()
  })
})
