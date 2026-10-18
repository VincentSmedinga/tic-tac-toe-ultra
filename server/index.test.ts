import { describe, expect, it } from 'vitest'
import { computeStats } from '../shared/stats.ts'
import worker from './index.ts'
import type { Env } from './env.ts'

/** The rooms of a fake Cloudflare: a list of codes, and what a request to a room answers. */
const STORED = {
  id: 'abcdefghijklmnop',
  finishedAt: 1,
  config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
  moves: [],
  players: [{ id: 'X' }, { id: 'O' }],
  result: { kind: 'draw' },
}

const STATS = computeStats([], 0)

function fakeEnv(existing: readonly string[] = []) {
  const rooms = new Set(existing)
  const forwarded: Request[] = []
  const fields: unknown[] = []
  const seatCounts: number[] = []
  const listed: { token: string; limit: number; before?: string | undefined }[] = []
  const env = {
    ARCHIVE: {
      getByName: () => ({
        stats: () => Promise.resolve(STATS),
        get: (id: string) => Promise.resolve(id === STORED.id ? STORED : null),
        list: (token: string, limit: number, before?: string) => {
          listed.push({ token, limit, before })
          return Promise.resolve({ games: [] })
        },
      }),
    },
    ROOM: {
      getByName: (code: string) => ({
        create: (newCode: string, field: unknown, seats: number) => {
          if (rooms.has(code)) return Promise.resolve(false)
          rooms.add(newCode)
          fields.push(field)
          seatCounts.push(seats)
          return Promise.resolve(true)
        },
        exists: () => Promise.resolve(rooms.has(code)),
        fetch: (request: Request) => {
          forwarded.push(request)
          return Promise.resolve(new Response(null, { status: rooms.has(code) ? 200 : 404 }))
        },
      }),
    },
  } as unknown as Env
  return { env, rooms, forwarded, listed, fields, seatCounts }
}

const call = (path: string, init?: RequestInit, env = fakeEnv().env) =>
  worker.fetch(new Request(`https://game.example${path}`, init) as never, env)

describe('the Worker', () => {
  it('says it is up on /api/health', async () => {
    const response = await call('/api/health')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('answers any other address under /api with a 404', async () => {
    for (const path of ['/api/nope', '/api/rooms/abcd', '/api/rooms/BCDF/other']) {
      expect((await call(path)).status).toBe(404)
    }
  })
})

describe('making a room', () => {
  it('answers with a code of four consonants, and the room exists', async () => {
    const { env, rooms } = fakeEnv()
    const response = await call('/api/rooms', { method: 'POST' }, env)
    expect(response.status).toBe(201)
    const { code } = await response.json<{ code: string }>()
    expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
    expect(rooms.has(code)).toBe(true)
  })

  it('is only for POST', async () => {
    const response = await call('/api/rooms')
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('POST')
  })
})

describe('making a room with a field of its own', () => {
  const post = (body: BodyInit | undefined, env = fakeEnv().env) =>
    call('/api/rooms', { method: 'POST', body }, env)

  it('makes a classic room when nothing is asked for', async () => {
    const { env, fields } = fakeEnv()
    expect((await post(undefined, env)).status).toBe(201)
    expect(fields).toEqual([{ width: 3, height: 3, winLength: 3 }])
  })

  it('makes the room for two when nothing is said about how many play', async () => {
    const { env, seatCounts } = fakeEnv()
    await post(undefined, env)
    await post(JSON.stringify({ width: 7, height: 7, winLength: 5 }), env)
    expect(seatCounts).toEqual([2, 2])
  })

  it('makes the room for as many people as was asked, up to twelve', async () => {
    const { env, seatCounts, fields } = fakeEnv()
    for (const players of [2, 5, 12]) {
      const response = await post(
        JSON.stringify({ width: 9, height: 9, winLength: 5, players }),
        env,
      )
      expect(response.status).toBe(201)
    }
    expect(seatCounts).toEqual([2, 5, 12])
    // The number of people is not part of the field.
    expect(fields[0]).toEqual({ width: 9, height: 9, winLength: 5 })
  })

  it('refuses a room for one person, for thirteen, or for half a person', async () => {
    const { env, rooms } = fakeEnv()
    for (const players of [0, 1, 13, 2.5, 'many']) {
      const response = await post(
        JSON.stringify({ width: 7, height: 7, winLength: 5, players }),
        env,
      )
      expect(response.status, String(players)).toBe(400)
    }
    expect(rooms.size).toBe(0)
  })

  it('makes the room with the field that was asked for', async () => {
    const { env, fields } = fakeEnv()
    const response = await post(JSON.stringify({ width: 7, height: 9, winLength: 5 }), env)
    expect(response.status).toBe(201)
    expect(fields).toEqual([{ width: 7, height: 9, winLength: 5 }])
  })

  it('refuses a field that is too big, even, too long a row or no field at all, and makes no room', async () => {
    const { env, rooms } = fakeEnv()
    for (const body of [
      { width: 21, height: 3, winLength: 3 },
      { width: 4, height: 3, winLength: 3 },
      { width: 5, height: 5, winLength: 4 },
      { width: 3, height: 3, winLength: 5 },
      { width: 3 },
      'nonsense',
      [],
    ]) {
      const response = await post(JSON.stringify(body), env)
      expect(response.status, JSON.stringify(body)).toBe(400)
      expect(await response.json()).toEqual({ error: 'bad-field' })
    }
    expect((await post('{not json', env)).status).toBe(400)
    expect(rooms.size).toBe(0)
  })
})

describe('asking for a room', () => {
  it('says whether it exists', async () => {
    const { env } = fakeEnv(['BCDF'])
    expect(await (await call('/api/rooms/BCDF', undefined, env)).json()).toEqual({ exists: true })
    expect(await (await call('/api/rooms/GHJK', undefined, env)).json()).toEqual({ exists: false })
  })
})

describe('the WebSocket of a room', () => {
  const upgrade = { headers: { Upgrade: 'websocket' } }

  it('is handed to the room', async () => {
    const { env, forwarded } = fakeEnv(['BCDF'])
    const response = await call('/api/rooms/BCDF/ws', upgrade, env)
    expect(response.status).toBe(200)
    expect(forwarded).toHaveLength(1)
  })

  it('is refused without an Upgrade header', async () => {
    expect((await call('/api/rooms/BCDF/ws')).status).toBe(426)
  })

  it('is refused for a page of another site, and allowed for this one or for no page at all', async () => {
    const { env } = fakeEnv(['BCDF'])
    const from = (origin: string) => ({ headers: { Upgrade: 'websocket', Origin: origin } })
    expect((await call('/api/rooms/BCDF/ws', from('https://evil.example'), env)).status).toBe(403)
    expect((await call('/api/rooms/BCDF/ws', from('https://game.example'), env)).status).toBe(200)
    expect((await call('/api/rooms/BCDF/ws', upgrade, env)).status).toBe(200)
  })

  it('is a 404 for a code that is no code, and for a room that does not exist', async () => {
    expect((await call('/api/rooms/abc/ws', upgrade)).status).toBe(404)
    expect((await call('/api/rooms/GHJK/ws', upgrade)).status).toBe(404)
  })
})

describe('a finished game', () => {
  it('is answered for anyone who has the id', async () => {
    const response = await call(`/api/games/${STORED.id}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(STORED)
  })

  it('is a 404 for an id nothing was kept under, and for something that is no id', async () => {
    expect((await call('/api/games/zzzzzzzzzzzzzzzz')).status).toBe(404)
    expect((await call('/api/games/short')).status).toBe(404)
    expect((await call(`/api/games/${STORED.id}/more`)).status).toBe(404)
  })

  it('is only for GET', async () => {
    const response = await call(`/api/games/${STORED.id}`, { method: 'POST' })
    expect(response.status).toBe(405)
  })
})

describe('the games of a browser', () => {
  const TOKEN = 'abcdefghijklmnopqrstuvwx'
  const ask = (query = '', token: string | null = TOKEN, env = fakeEnv().env) =>
    call(
      `/api/games${query}`,
      token === null ? undefined : { headers: { 'X-Player-Token': token } },
      env,
    )

  it('is asked for with the token in a header, and the first page is 20 games', async () => {
    const { env, listed } = fakeEnv()
    const response = await ask('', TOKEN, env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ games: [] })
    expect(listed).toEqual([{ token: TOKEN, limit: 20, before: undefined }])
  })

  it('is never kept by a cache that others use', async () => {
    expect((await ask()).headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('passes on the page asked for', async () => {
    const { env, listed } = fakeEnv()
    await ask('?limit=5&before=1700000000000.abcdefghijklmnop', TOKEN, env)
    expect(listed).toEqual([{ token: TOKEN, limit: 5, before: '1700000000000.abcdefghijklmnop' }])
  })

  it('is refused without a token, or with one that is no token', async () => {
    expect((await ask('', null)).status).toBe(401)
    expect((await ask('', 'short')).status).toBe(401)
  })

  it('is refused for a page that makes no sense', async () => {
    for (const query of ['?limit=0', '?limit=51', '?limit=abc', '?before=nonsense']) {
      expect((await ask(query)).status).toBe(400)
    }
  })

  it('is only for GET, and the token is never read from the address', async () => {
    expect((await call('/api/games', { method: 'POST' })).status).toBe(405)
    expect((await ask(`?token=${TOKEN}`, null)).status).toBe(401)
  })
})

describe('GET /api/stats', () => {
  it('answers the statistics of the archive, for a short while to every browser', async () => {
    const response = await call('/api/stats')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(STATS)
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=30')
  })

  it('needs no token and takes none', async () => {
    const response = await call('/api/stats', { headers: { 'X-Player-Token': 'x'.repeat(20) } })
    expect(response.status).toBe(200)
  })

  it('is only for GET and has nothing below it', async () => {
    expect((await call('/api/stats', { method: 'POST' })).status).toBe(405)
    expect((await call('/api/stats/more')).status).toBe(404)
  })
})
