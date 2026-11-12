import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env.ts'
import type { Member } from './house-logic.ts'
import { HouseSession } from './house-session.ts'
import type { HouseHost } from './house-session.ts'
import { EXPIRES_AFTER_MS, mayGo } from './room-expiry.ts'

const CODE_KEY = 'code'
const TOUCHED_KEY = 'touched'

/** What a socket remembers about itself while the house sleeps: who is on it, once they joined. */
interface Attachment {
  id: string
  member: Member | null
}

/**
 * One house: its code in storage (SQLite) and the sockets of the people who have it open, on the
 * WebSocket Hibernation API. Who is in the house lives on the sockets only, so a house keeps nobody
 * who isn't there. The rules are in house-logic.ts and what happens on a message in
 * house-session.ts; this class only connects them to Cloudflare.
 */
export class House extends DurableObject<Env> {
  /** Makes the house with this code; false when it already exists. Called by the Worker. */
  create(code: string): boolean {
    if (this.exists()) return false
    this.ctx.storage.kv.put(CODE_KEY, code)
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
    if (!this.exists()) return new Response('No such house', { status: 404 })

    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ id: crypto.randomUUID(), member: null } satisfies Attachment)
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

  /** A house that nobody has had open for a day is deleted; while somebody has, its day starts again. */
  override async alarm(): Promise<void> {
    const connected = this.ctx.getWebSockets().some((ws) => ws.readyState === WebSocket.OPEN)
    const touched = this.ctx.storage.kv.get<number>(TOUCHED_KEY) ?? 0
    const idleMs = Date.now() - touched
    if (mayGo({ queued: 0, connected, asked: false, idleMs })) await this.ctx.storage.deleteAll()
    else if (connected) this.touch()
    else void this.ctx.storage.setAlarm(touched + EXPIRES_AFTER_MS)
  }

  private touch(): void {
    this.ctx.storage.kv.put(TOUCHED_KEY, Date.now())
    void this.ctx.storage.setAlarm(Date.now() + EXPIRES_AFTER_MS)
  }

  private session(): HouseSession {
    const sockets = () => this.ctx.getWebSockets()
    const find = (id: string) => sockets().find((ws) => attachmentOf(ws).id === id)
    const host: HouseHost = {
      code: String(this.ctx.storage.kv.get(CODE_KEY) ?? ''),
      sockets: () =>
        sockets().map((ws) => ({
          ...attachmentOf(ws),
          open: ws.readyState === WebSocket.OPEN,
        })),
      attach: (id, member) => {
        find(id)?.serializeAttachment({ id, member } satisfies Attachment)
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
      now: () => Date.now(),
    }
    return new HouseSession(host)
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}
