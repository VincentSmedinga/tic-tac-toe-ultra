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
