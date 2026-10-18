import { gameIdSchema, roomCodeSchema } from '../shared/protocol.ts'
import { ARCHIVE_NAME } from './archive.ts'
import type { Env } from './env.ts'
import { newRoomCode } from './room-code.ts'

export { Archive } from './archive.ts'
export { Room } from './room.ts'

/** How often a new room code is tried before giving up: a clash is rare, 160,000 codes are free. */
const CREATE_ATTEMPTS = 10

/**
 * The Worker: answers /api/*; every other address is the app, which Cloudflare serves itself.
 *   POST /api/rooms          make a room, answers { code }
 *   GET  /api/rooms/:code    answers { exists }
 *   GET  /api/rooms/:code/ws the WebSocket of the room, which is a Durable Object
 *   GET  /api/games/:id      a finished game as it was kept, for anyone who has the id
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
      return createRoom(env)
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
  const id = gameIdSchema.safeParse(parts[2])
  if (parts.length !== 3 || !id.success) return notFound()
  if (request.method !== 'GET') return methodNotAllowed('GET')
  const game = await env.ARCHIVE.getByName(ARCHIVE_NAME).get(id.data)
  return game ? Response.json(game) : notFound()
}

async function createRoom(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = newRoomCode()
    if (await env.ROOM.getByName(code).create(code)) {
      return Response.json({ code }, { status: 201 })
    }
  }
  return Response.json({ error: 'no-free-code' }, { status: 503 })
}

function notFound(): Response {
  return Response.json({ error: 'not-found' }, { status: 404 })
}

function methodNotAllowed(allow: string): Response {
  return Response.json({ error: 'method-not-allowed' }, { status: 405, headers: { Allow: allow } })
}
