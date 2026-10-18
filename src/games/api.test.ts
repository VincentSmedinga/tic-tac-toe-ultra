import { afterEach, describe, expect, it, vi } from 'vitest'
import { gamesApi } from './api.ts'

const TOKEN = 'abcdefghijklmnopqrstuvwx'
const STORED = {
  id: 'abcdefghijklmnop',
  finishedAt: 1,
  config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
  moves: [],
  players: [{ id: 'X' }, { id: 'O' }],
  result: { kind: 'draw' },
}

function answer(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(body, { status }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('listing the games', () => {
  it('asks /api/games with the token in a header, never in the address', async () => {
    const fetch = answer({ games: [] })
    expect(await gamesApi.listGames(TOKEN)).toEqual({ games: [] })
    expect(fetch).toHaveBeenCalledWith('/api/games', { headers: { 'X-Player-Token': TOKEN } })
  })

  it('asks for the page after the one before', async () => {
    const fetch = answer({ games: [] })
    await gamesApi.listGames(TOKEN, '1700000000000.abcdefghijklmnop')
    expect(fetch).toHaveBeenCalledWith('/api/games?before=1700000000000.abcdefghijklmnop', {
      headers: { 'X-Player-Token': TOKEN },
    })
  })

  it('fails when the server says it could not, or answers something else', async () => {
    answer({ error: 'x' }, 500)
    await expect(gamesApi.listGames(TOKEN)).rejects.toThrow('500')
    answer({ games: 'many' })
    await expect(gamesApi.listGames(TOKEN)).rejects.toThrow()
  })
})

describe('getting a game', () => {
  it('asks /api/games/<id> and gives the game', async () => {
    const fetch = answer(STORED)
    expect(await gamesApi.getGame(STORED.id)).toEqual(STORED)
    expect(fetch).toHaveBeenCalledWith(`/api/games/${STORED.id}`)
  })

  it('gives null for a game that is not there', async () => {
    answer({ error: 'not-found' }, 404)
    expect(await gamesApi.getGame('zzzzzzzzzzzzzzzz')).toBeNull()
  })

  it('fails when the server could not say, or says something odd', async () => {
    answer({ error: 'x' }, 500)
    await expect(gamesApi.getGame(STORED.id)).rejects.toThrow('500')
    answer({ id: 'abcdefghijklmnop' })
    await expect(gamesApi.getGame(STORED.id)).rejects.toThrow()
  })
})
