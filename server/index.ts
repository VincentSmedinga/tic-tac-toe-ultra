import {
  GAMES_PAGE_SIZE,
  fieldSchema,
  MAX_GAMES_PAGE_SIZE,
  gameIdSchema,
  gamesCursorSchema,
  roomCodeSchema,
  tokenSchema,
} from '../shared/protocol.ts'
import { CLASSIC_FIELD } from '../shared/room.ts'
import type { FieldSettings } from '../shared/room.ts'
import { ARCHIVE_NAME } from './archive.ts'
import type { Env } from './env.ts'
import { newRoomCode } from './room-code.ts'

export { Archive } from './archive.ts'
export { Room } from './room.ts'

/** How often a new room code is tried before giving up: a clash is rare, 160,000 codes are free. */
const CREATE_ATTEMPTS = 10

/**
 * The Worker: answers /api/*; every other address is the app, which Cloudflare serves itself.
 *   POST /api/rooms          make a room, answers { code }; the body may say how big the field is
 *                            ({ width, height, winLength }), without one it is classic 3×3
 *   GET  /api/rooms/:code    answers { exists }
 *   GET  /api/rooms/:code/ws the WebSocket of the room, which is a Durable Object
 *   GET  /api/games/:id      a finished game as it was kept, for anyone who has the id
 *   GET  /api/games          the games of the browser whose token is in the X-Player-Token header
 *                            (never in the address), newest first, ?before=<next> and ?limit=<n>
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean) // ['api', 'rooms', code?, 'ws'?]
    if (parts[0] !== 'api') return notFound()

    if (parts[1] === 'health' && parts.length === 2) return Response.json({ status: 'ok' })
    if (parts[1] === 'games') return getGame(parts, request, env)
    if (parts[1] !== 'rooms') return notFound()

    if (parts.length === 2) {
      if (request.method !== 'POST') return methodNotAllowed('POST')
      return createRoom(request, env)
    }

    const code = roomCodeSchema.safeParse(parts[2])
    if (!code.success) return notFound()
    const room = env.ROOM.getByName(code.data)

    if (parts.length === 3) {
      if (request.method !== 'GET') return methodNotAllowed('GET')
      return Response.json({ exists: await room.exists() })
    }

    if (parts.length === 4 && parts[3] === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected a WebSocket', { status: 426 })
      }
      // A browser says which site opened the socket; only this site may, or any page could use ours.
      const origin = request.headers.get('Origin')
      if (origin !== null && new URL(origin).host !== url.host) {
        return new Response('Wrong origin', { status: 403 })
      }
      return room.fetch(request)
    }
    return notFound()
  },
} satisfies ExportedHandler<Env>

async function getGame(parts: string[], request: Request, env: Env): Promise<Response> {
  if (parts.length === 2) return listGames(request, env)
  const id = gameIdSchema.safeParse(parts[2])
  if (parts.length !== 3 || !id.success) return notFound()
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const game = await env.ARCHIVE.getByName(ARCHIVE_NAME).get(id.data)
  return game ? Response.json(game) : notFound()
}

async function listGames(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const token = tokenSchema.safeParse(request.headers.get('X-Player-Token'))
  if (!token.success) return Response.json({ error: 'no-token' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before') ?? undefined
  if (before !== undefined && !gamesCursorSchema.safeParse(before).success) return badRequest()
  const asked = searchParams.get('limit')
  const limit = asked === null ? GAMES_PAGE_SIZE : Number(asked)
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_GAMES_PAGE_SIZE) return badRequest()

  const page = await env.ARCHIVE.getByName(ARCHIVE_NAME).list(token.data, limit, before)
  // What one browser played is for that browser only: no cache may keep it for someone else.
  return Response.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
}

function badRequest(): Response {
  return Response.json({ error: 'bad-request' }, { status: 400 })
}

async function createRoom(request: Request, env: Env): Promise<Response> {
  const field = await fieldOfRequest(request)
  if (!field) return Response.json({ error: 'bad-field' }, { status: 400 })
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = newRoomCode()
    if (await env.ROOM.getByName(code).create(code, field)) {
      return Response.json({ code }, { status: 201 })
    }
  }
  return Response.json({ error: 'no-free-code' }, { status: 503 })
}

/** The field a request asks for: classic without a body; null when what is asked for is no field. */
async function fieldOfRequest(request: Request): Promise<FieldSettings | null> {
  const text = await request.text()
  if (text.trim() === '') return CLASSIC_FIELD
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = fieldSchema.safeParse(json)
  return parsed.success ? parsed.data : null
}

function notFound(): Response {
  return Response.json({ error: 'not-found' }, { status: 404 })
}

function methodNotAllowed(allow: string): Response {
  return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: allow } })
}
