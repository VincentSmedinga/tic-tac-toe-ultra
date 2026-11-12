import { DurableObject } from 'cloudflare:workers'
import type { FieldSettings } from '../shared/room.ts'
import type { Env } from './env.ts'
import { EMPTY_HOUSE } from './house-logic.ts'
import type { HouseData, Member } from './house-logic.ts'
import { HouseSession } from './house-session.ts'
import type { HouseHost } from './house-session.ts'
import { newRoomCode } from './room-code.ts'
import { EXPIRES_AFTER_MS, mayGo } from './room-expiry.ts'
import type { HouseSeat } from './room-logic.ts'
import type { RoomReport } from './room-session.ts'

const CODE_KEY = 'code'
const TOUCHED_KEY = 'touched'
const DATA_KEY = 'data'
/** How often a new room code is tried before giving up, as the Worker does. */
const CREATE_ATTEMPTS = 10

/** What a socket remembers about itself while the house sleeps: who is on it, once they joined. */
interface Attachment {
  id: string
  member: Member | null
}

/**
 * One house: its code, its invitations and its games in storage (SQLite), and the sockets of the
 * people who have it open, on the WebSocket Hibernation API. Who has the house open lives on the
 * sockets only. The rules are in house-logic.ts and what happens on a message in house-session.ts;
 * this class only connects them to Cloudflare.
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

  /** A room this house made says how its round is going. Called by the room. */
  roomReport(room: string, report: RoomReport): void {
    if (this.exists()) this.session().report(room, report)
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

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.session().message(attachmentOf(ws).id, message)
  }

  override webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // Answer the close, or the socket stays half open until the runtime gives up on it.
    ws.close(code === 1005 ? 1000 : code, reason)
    this.session().closed()
  }

  override webSocketError(): void {
    this.session().closed()
  }

  /**
   * Runs for two reasons: an invitation's minute is up, and a house that nobody has had open for a
   * day is deleted (while somebody has, its day starts again).
   */
  override async alarm(): Promise<void> {
    await this.session().settle()
    const connected = this.ctx.getWebSockets().some((ws) => ws.readyState === WebSocket.OPEN)
    const touched = this.ctx.storage.kv.get<number>(TOUCHED_KEY) ?? 0
    const idleMs = Date.now() - touched
    if (mayGo({ queued: 0, connected, asked: false, idleMs })) await this.ctx.storage.deleteAll()
    else if (connected && idleMs >= EXPIRES_AFTER_MS) this.touch()
    else this.schedule()
  }

  private touch(): void {
    this.ctx.storage.kv.put(TOUCHED_KEY, Date.now())
    this.schedule()
  }

  private data(): HouseData {
    return this.ctx.storage.kv.get<HouseData>(DATA_KEY) ?? EMPTY_HOUSE
  }

  /** The next alarm: when the first invitation lapses, or else when the house expires. */
  private schedule(): void {
    const touched = this.ctx.storage.kv.get<number>(TOUCHED_KEY) ?? Date.now()
    const lapses = this.data().invitations.map((invitation) => invitation.lapses)
    void this.ctx.storage.setAlarm(Math.min(touched + EXPIRES_AFTER_MS, ...lapses))
  }

  /** Makes a room for the people of an invitation, with a code that is free. */
  private async makeRoom(field: FieldSettings, seats: HouseSeat[]): Promise<string | null> {
    const house = String(this.ctx.storage.kv.get(CODE_KEY) ?? '')
    try {
      for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
        const code = newRoomCode()
        if (await this.env.ROOM.getByName(code).createForHouse(code, field, seats, house)) {
          return code
        }
      }
    } catch (error) {
      console.error('could not make a room for the house', error)
    }
    return null
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
      load: () => this.data(),
      save: (data) => {
        this.ctx.storage.kv.put(DATA_KEY, data)
        this.schedule()
      },
      makeRoom: (field, seats) => this.makeRoom(field, seats),
    }
    return new HouseSession(host)
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}
