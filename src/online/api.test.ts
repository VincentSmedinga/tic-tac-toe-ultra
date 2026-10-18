import { afterEach, describe, expect, it, vi } from 'vitest'
import { roomApi } from './api.ts'

function answer(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('making a room', () => {
  it('posts to /api/rooms and gives the code', async () => {
    const fetch = answer({ code: 'BCDF' }, 201)
    expect(await roomApi.createRoom()).toBe('BCDF')
    expect(fetch).toHaveBeenCalledWith('/api/rooms', { method: 'POST' })
  })

  it('posts the field that is asked for as JSON', async () => {
    const fetch = answer({ code: 'BCDF' }, 201)
    await roomApi.createRoom({ width: 7, height: 5, winLength: 5 })
    expect(fetch).toHaveBeenCalledWith('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: 7, height: 5, winLength: 5 }),
    })
  })

  it('fails when the server says it could not', async () => {
    answer({ error: 'no-free-code' }, 503)
    await expect(roomApi.createRoom()).rejects.toThrow('503')
  })

  it('fails when what comes back is no room code', async () => {
    answer({ code: 'abcd' })
    await expect(roomApi.createRoom()).rejects.toThrow()
    answer({ nothing: true })
    await expect(roomApi.createRoom()).rejects.toThrow()
  })
})

describe('asking for a room', () => {
  it('asks /api/rooms/<code> and says whether it exists', async () => {
    const fetch = answer({ exists: true })
    expect(await roomApi.roomExists('BCDF')).toBe(true)
    expect(fetch).toHaveBeenCalledWith('/api/rooms/BCDF')
    answer({ exists: false })
    expect(await roomApi.roomExists('GHJK')).toBe(false)
  })

  it('fails when the server cannot say, or says something else', async () => {
    answer({ error: 'not-found' }, 404)
    await expect(roomApi.roomExists('BCDF')).rejects.toThrow('404')
    answer({ exists: 'yes' })
    await expect(roomApi.roomExists('BCDF')).rejects.toThrow()
  })
})
