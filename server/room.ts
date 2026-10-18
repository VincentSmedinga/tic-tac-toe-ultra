import { DurableObject } from 'cloudflare:workers'
import { ARCHIVE_NAME } from './archive.ts'
import type { Env } from './env.ts'
import { newGameId } from './game-id.ts'
import { newRoom } from './room-logic.ts'
import type { RoomState } from './room-logic.ts'
import { RoomSession } from './room-session.ts'
import type { Host } from './room-session.ts'

const ROOM_KEY = 'room'
const CODE_KEY = 'code'
/** A room that nobody has touched for this long is deleted, with everything in it. */
const EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000

/** What a socket remembers about itself while the room sleeps. */
interface Attachment {
  id: string
  token: string | null
}

/**
 * One room of the game: the state in storage (SQLite), the players' sockets on the WebSocket
 * Hibernation API, so that a room where nobody moves costs nothing. The rules are in room-logic.ts
 * and what happens on a message in room-session.ts; this class only connects them to Cloudflare.
 */
export class Room extends DurableObject<Env> {
  /** Makes the room with this code; false when it already exists. Called by the Worker. */
  create(code: string): boolean {
    if (this.exists()) return false
    this.ctx.storage.kv.put(CODE_KEY, code)
    this.ctx.storage.kv.put(ROOM_KEY, newRoom())
    this.touch()
    return true
  }

  exists(): boolean {
    return this.ctx.storage.kv.get(CODE_KEY) !== undefined
  }

  override fetch(request: Request): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket', { status: 426 })
    }
    if (!this.exists()) return new Response('No such room', { status: 404 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    const attachment: Attachment = { id: crypto.randomUUID(), token: null }
    server.serializeAttachment(attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    this.session().message(attachmentOf(ws).id, message)
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // Answer the close, or the socket stays half open until the runtime gives up on it.
    ws.close(code === 1005 ? 1000 : code, reason)
    this.session().closed()
  }

  override webSocketError(): void {
    this.session().closed()
  }

  override async alarm(): Promise<void> {
    const connected = this.ctx.getWebSockets().some((ws) => ws.readyState === WebSocket.OPEN)
    if (connected) {
      this.touch()
      return
    }
    await this.ctx.storage.deleteAll()
  }

  private touch(): void {
    void this.ctx.storage.setAlarm(Date.now() + EXPIRES_AFTER_MS)
  }

  private session(): RoomSession {
    const sockets = () => this.ctx.getWebSockets()
    const find = (id: string) => sockets().find((ws) => attachmentOf(ws).id === id)
    const host: Host = {
      code: String(this.ctx.storage.kv.get(CODE_KEY) ?? ''),
      load: () => this.ctx.storage.kv.get<RoomState>(ROOM_KEY) ?? null,
      save: (room) => {
        this.ctx.storage.kv.put(ROOM_KEY, room)
      },
      sockets: () =>
        sockets().map((ws) => ({
          id: attachmentOf(ws).id,
          token: attachmentOf(ws).token,
          open: ws.readyState === WebSocket.OPEN,
        })),
      attach: (id, token) => {
        const ws = find(id)
        if (ws) ws.serializeAttachment({ id, token } satisfies Attachment)
      },
      send: (id, message) => {
        find(id)?.send(JSON.stringify(message))
      },
      close: (id, code, reason) => {
        find(id)?.close(code, reason)
      },
      touch: () => {
        this.touch()
      },
      newGameId,
      archive: (id, game) => {
        // After the answer to the players has gone out; a failure is logged and never reaches them.
        this.ctx.waitUntil(
          this.env.ARCHIVE.getByName(ARCHIVE_NAME)
            .save({ id, ...game })
            .catch((error: unknown) => {
              console.error('Keeping a finished game failed', error)
            }),
        )
      },
    }
    return new RoomSession(host)
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}
