import { parseHouseClientMessage } from '../shared/house-protocol.ts'
import type { HouseErrorCode, HouseServerMessage } from '../shared/house-protocol.ts'
import { choose, join, stateFor } from './house-logic.ts'
import type { Member, Present } from './house-logic.ts'
import { CLOSE_REPLACED, CLOSE_ROOM_FULL } from './room-session.ts'

/** What a house needs from Cloudflare, so that the session below can be tested without it. */
export interface HouseHost {
  /** The code of the house, as people type it. */
  code: string
  /** Every socket there is, in any state; `member` is null until somebody has joined on it. */
  sockets(): { id: string; member: Member | null; open: boolean }[]
  /** Remember who is on this socket, also after the house has slept. */
  attach(id: string, member: Member): void
  send(id: string, message: HouseServerMessage): void
  close(id: string, code: number, reason: string): void
  /** Something happened: a house that nobody has had open for a day goes away. */
  touch(): void
  /** The time now, in milliseconds since 1970. */
  now(): number
}

/** The house is full: every shape is somebody's. The same code as a full room. */
export const CLOSE_HOUSE_FULL = CLOSE_ROOM_FULL

/**
 * What happens when a socket of a house says something or goes away: read the message, let the
 * rules in house-logic.ts decide, keep who is on the socket, and tell everybody how the house looks
 * now. The sender alone hears about an error.
 */
export class HouseSession {
  private readonly host: HouseHost

  constructor(host: HouseHost) {
    this.host = host
  }

  message(socketId: string, raw: unknown): void {
    const message = parseHouseClientMessage(raw)
    if (!message) {
      this.error(socketId, 'invalid-message')
      return
    }
    const present = this.present()

    if (message.type === 'join') {
      const joined = join(
        present.filter(({ id }) => id !== socketId),
        message.token,
        message.name,
        message.shape,
        this.host.now(),
      )
      if (!joined.ok) {
        this.error(socketId, joined.error)
        this.host.close(socketId, CLOSE_HOUSE_FULL, joined.error)
        return
      }
      this.host.attach(socketId, joined.member)
      // The same browser on a new socket (a phone that came back): the old one is no use any more.
      for (const socket of this.host.sockets()) {
        if (socket.id !== socketId && socket.member?.token === message.token) {
          this.host.close(socket.id, CLOSE_REPLACED, 'replaced')
        }
      }
      this.host.touch()
      this.broadcast()
      return
    }

    const member = present.find(({ id }) => id === socketId)?.member
    if (!member) {
      this.error(socketId, 'not-joined')
      return
    }
    const chosen = choose(present, member, message.shape)
    if (!chosen.ok) {
      this.error(socketId, chosen.error)
      return
    }
    this.host.attach(socketId, chosen.member)
    this.broadcast()
  }

  /** A socket went away: the others see that this person isn't there any more. */
  closed(): void {
    this.host.touch()
    this.broadcast()
  }

  /** The open sockets that somebody has joined on: the people in the house. */
  private present(): Present[] {
    return this.host
      .sockets()
      .flatMap(({ id, member, open }) => (open && member !== null ? [{ id, member }] : []))
  }

  private broadcast(): void {
    const present = this.present()
    for (const { id } of present) this.host.send(id, stateFor(present, id, this.host.code))
  }

  private error(socketId: string, error: HouseErrorCode): void {
    this.host.send(socketId, { type: 'error', error })
  }
}
