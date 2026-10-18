import { parseClientMessage } from '../shared/protocol.ts'
import type { ErrorCode, ServerMessage } from '../shared/protocol.ts'
import {
  choose,
  finishedGame,
  isOver,
  join,
  play,
  rematch,
  startGame,
  stateFor,
} from './room-logic.ts'
import type { Change, Finished, RoomState } from './room-logic.ts'

/** What a room needs from Cloudflare, so that the session below can be tested without it. */
export interface Host {
  /** The code of the room, as players type it. */
  code: string
  /** The saved state; null when the room doesn't exist (any more). */
  load(): RoomState | null
  save(room: RoomState): void
  /** Every socket there is, in any state; `token` is null until its player has joined. */
  sockets(): { id: string; token: string | null; open: boolean }[]
  /** Remember whose socket this is, also after the room has slept. */
  attach(id: string, token: string): void
  send(id: string, message: ServerMessage): void
  close(id: string, code: number, reason: string): void
  /** Something happened: a room that nobody touches for a day goes away. */
  touch(): void
  /** The time now, in milliseconds since 1970. */
  now(): number
  /** A fresh, unguessable id for a game that is about to be kept. */
  newGameId(): string
  /**
   * Keep a finished game, under this id, for good: it outlives the room. Must not throw. When the
   * archive has it, the host tells the session with `archived`; until then the id stays secret.
   */
  archive(id: string, game: Finished): void
}

/** WebSocket close codes in the range for applications. */
export const CLOSE_REPLACED = 4001
export const CLOSE_UNKNOWN_ROOM = 4404
export const CLOSE_ROOM_FULL = 4409

/**
 * What happens when a player's socket says something or goes away: read the message, let the rules
 * in room-logic.ts decide, save, and tell every connected player how the room looks now. The sender
 * alone hears about an error.
 */
export class RoomSession {
  private readonly host: Host

  constructor(host: Host) {
    this.host = host
  }

  message(socketId: string, raw: unknown): void {
    const message = parseClientMessage(raw)
    if (!message) {
      this.error(socketId, 'invalid-message')
      return
    }

    const room = this.host.load()
    if (!room) {
      this.host.close(socketId, CLOSE_UNKNOWN_ROOM, 'unknown-room')
      return
    }

    if (message.type === 'join') {
      const change = join(room, message.token, message.name, message.shape)
      if (!change.ok) {
        this.error(socketId, change.error)
        this.host.close(socketId, CLOSE_ROOM_FULL, change.error)
        return
      }
      this.host.attach(socketId, message.token)
      // The same player on a new socket (a phone that came back): the old one is no use any more.
      for (const socket of this.host.sockets()) {
        if (socket.id !== socketId && socket.token === message.token) {
          this.host.close(socket.id, CLOSE_REPLACED, 'replaced')
        }
      }
      this.commit(change.room)
      return
    }

    const token = this.host.sockets().find((socket) => socket.id === socketId)?.token
    if (token === null || token === undefined) {
      this.error(socketId, 'not-joined')
      return
    }

    let change: Change
    switch (message.type) {
      case 'move':
        change = play(room, token, { x: message.x, y: message.y })
        break
      case 'choose':
        change = choose(room, token, message.shape)
        break
      case 'start':
        change = startGame(room, token)
        break
      case 'rematch':
        change = rematch(room, token)
        break
    }
    if (!change.ok) {
      this.error(socketId, change.error)
      return
    }
    // The first move of a round says when the game started, which is what its duration is from.
    const played =
      message.type === 'move' && room.moves.length === 0 && change.room.moves.length === 1
        ? { ...change.room, startedAt: this.host.now() }
        : change.room
    // The move that ends a round keeps the game, right then and only once, however many players are
    // still connected: a player who has left or lost the connection by now doesn't matter.
    const finished = !isOver(room) ? finishedGame(played) : null
    if (finished) {
      const gameId = this.host.newGameId()
      this.host.archive(gameId, finished)
      this.commit({ ...played, gameId })
      return
    }
    this.commit(played)
  }

  /** The archive has the game with this id: from now on the players are told where it is kept. */
  archived(gameId: string): void {
    const room = this.host.load()
    // A rematch may have started in the meantime: then the id belongs to a round that is over.
    if (room?.gameId !== gameId || room.archived === true) return
    this.commit({ ...room, archived: true })
  }

  /** A socket went away: whoever is left sees that their opponent is no longer connected. */
  closed(): void {
    const room = this.host.load()
    if (room) this.broadcast(room)
  }

  private commit(room: RoomState): void {
    this.host.save(room)
    this.host.touch()
    this.broadcast(room)
  }

  private broadcast(room: RoomState): void {
    const sockets = this.host.sockets().filter((socket) => socket.open)
    const connected = new Set<string>()
    for (const { token } of sockets) if (token !== null) connected.add(token)
    for (const { id, token } of sockets) {
      if (token === null) continue
      const state = stateFor(room, token, this.host.code, connected)
      if (state) this.host.send(id, state)
    }
  }

  private error(socketId: string, error: ErrorCode): void {
    this.host.send(socketId, { type: 'error', error })
  }
}
