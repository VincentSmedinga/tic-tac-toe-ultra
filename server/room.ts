import { DurableObject } from 'cloudflare:workers'
import { ARCHIVE_NAME } from './archive.ts'
import { ArchiveQueue } from './archive-queue.ts'
import type { Pending } from './archive-queue.ts'
import type { FieldSettings } from '../shared/room.ts'
import type { Env } from './env.ts'
import { newGameId } from './game-id.ts'
import { EXPIRES_AFTER_MS, mayGo } from './room-expiry.ts'
import { newRoom, upgradeRoom } from './room-logic.ts'
import type { RoomState } from './room-logic.ts'
import { RoomSession } from './room-session.ts'
import type { Host } from './room-session.ts'

const ROOM_KEY = 'room'
const CODE_KEY = 'code'
const ROOM_ID_KEY = 'room-id'
const TOUCHED_KEY = 'touched'
const PENDING_KEY = 'pending-archive'
const REMOVE_KEY = 'remove'
/** A game the archive couldn't keep is tried again after this long. */
const RETRY_AFTER_MS = 30 * 1000

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
  /** The finished games the archive hasn't confirmed yet; they live in this room's storage. */
  private readonly queue = new ArchiveQueue({
    read: () => this.ctx.storage.kv.get<Pending[]>(PENDING_KEY) ?? [],
    write: (pending) => {
      if (pending.length > 0) this.ctx.storage.kv.put(PENDING_KEY, pending)
      else this.ctx.storage.kv.delete(PENDING_KEY)
    },
    save: ({ id, finishedAt, game }) => {
      const roomId = this.ctx.storage.kv.get<string>(ROOM_ID_KEY)
      return this.env.ARCHIVE.getByName(ARCHIVE_NAME).save(
        { id, ...(roomId === undefined ? {} : { roomId }), ...game },
        finishedAt,
      )
    },
    saved: (id) => {
      this.session().archived(id)
    },
  })

  /**
   * Makes the room with this code; false when it already exists. Called by the Worker. The room
   * gets an id of its own (the code is used again once a room is gone), which the archive uses to
   * count the rooms and the rounds of each.
   */
  async create(code: string, field: FieldSettings, seats: number): Promise<boolean> {
    if (this.exists()) return false
    const roomId = newGameId()
    this.ctx.storage.kv.put(CODE_KEY, code)
    this.ctx.storage.kv.put(ROOM_ID_KEY, roomId)
    this.ctx.storage.kv.put(ROOM_KEY, newRoom(field, seats))
    this.touch()
    try {
      await this.env.ARCHIVE.getByName(ARCHIVE_NAME).roomMade(roomId, Date.now(), seats)
    } catch (error) {
      // Only a count is lost: the room works without it.
      console.error('could not note the new room in the archive', error)
    }
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

  /**
   * Runs for two reasons: a game the archive couldn't keep is tried again, and a room that nobody
   * has touched for a day, or that everybody has left, is deleted. The room is kept for as long as
   * a game is waiting for the archive, so that a game is never lost with the room.
   */
  override async alarm(): Promise<void> {
    await this.queue.flush()
    const standing = {
      queued: this.queue.size(),
      connected: this.ctx.getWebSockets().some((ws) => ws.readyState === WebSocket.OPEN),
      asked: this.ctx.storage.kv.get(REMOVE_KEY) === true,
      idleMs: Date.now() - (this.ctx.storage.kv.get<number>(TOUCHED_KEY) ?? 0),
    }
    if (mayGo(standing)) await this.ctx.storage.deleteAll()
    // Someone is still connected: the room is in use, so its day starts again.
    else if (standing.connected && standing.queued === 0) this.touch()
    else this.schedule()
  }

  private touch(): void {
    this.ctx.storage.kv.put(TOUCHED_KEY, Date.now())
    this.schedule()
  }

  /** The next alarm: soon when a game is waiting for the archive, else when the room expires. */
  private schedule(): void {
    const at =
      this.queue.size() > 0
        ? Date.now() + RETRY_AFTER_MS
        : (this.ctx.storage.kv.get<number>(TOUCHED_KEY) ?? Date.now()) + EXPIRES_AFTER_MS
    void this.ctx.storage.setAlarm(at)
  }

  private async keepGames(): Promise<void> {
    await this.queue.flush()
    this.schedule()
  }

  private session(): RoomSession {
    const sockets = () => this.ctx.getWebSockets()
    const find = (id: string) => sockets().find((ws) => attachmentOf(ws).id === id)
    const host: Host = {
      code: String(this.ctx.storage.kv.get(CODE_KEY) ?? ''),
      load: () => {
        const room = this.ctx.storage.kv.get<RoomState>(ROOM_KEY)
        return room ? upgradeRoom(room) : null
      },
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
      now: () => Date.now(),
      remove: () => {
        this.ctx.storage.kv.put(REMOVE_KEY, true)
        void this.ctx.storage.setAlarm(Date.now())
      },
      newGameId,
      archive: (id, game) => {
        // Written to storage first, so the game survives a failed call, a sleep and a rematch; the
        // players hear the id once the archive has it (see `archived` in room-session.ts).
        this.queue.add(id, game, Date.now())
        this.ctx.waitUntil(this.keepGames())
      },
    }
    return new RoomSession(host)
  }
}

function attachmentOf(ws: WebSocket): Attachment {
  return ws.deserializeAttachment() as Attachment
}
