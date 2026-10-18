import { describe, expect, it } from 'vitest'
import worker from './index.ts'
import type { Env } from './env.ts'

/** The rooms of a fake Cloudflare: a list of codes, and what a request to a room answers. */
function fakeEnv(existing: readonly string[] = []) {
  const rooms = new Set(existing)
  const forwarded: Request[] = []
  const env = {
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
  return { env, rooms, forwarded }
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
