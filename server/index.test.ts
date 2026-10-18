import { describe, expect, it } from 'vitest'
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

function fakeEnv(existing: readonly string[] = []) {
  const rooms = new Set(existing)
  const forwarded: Request[] = []
  const listed: { token: string; limit: number; before?: string | undefined }[] = []
  const env = {
    ARCHIVE: {
      getByName: () => ({
        get: (id: string) => Promise.resolve(id === STORED.id ? STORED : null),
        list: (token: string, limit: number, before?: string) => {
          listed.push({ token, limit, before })
          return Promise.resolve({ games: [] })
        },
      }),
    },
    ROOM: {
      getByName: (code: string) => ({
        create: (newCode: string) => {
          if (rooms.has(code)) return Promise.resolve(false)
          rooms.add(newCode)
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
  return { env, rooms, forwarded, listed }
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
