import { parseHouseClientMessage } from '../shared/house-protocol.ts'
import type { HouseErrorCode, HouseServerMessage } from '../shared/house-protocol.ts'
import {
  answer,
  choose,
  gameMade,
  invite,
  join,
  playersOf,
  reported,
  settle,
  stateFor,
} from './house-logic.ts'
import type { HouseData, Invitation, Member, Person, Present } from './house-logic.ts'
import type { HouseSeat } from './room-logic.ts'
import { CLOSE_REPLACED, CLOSE_ROOM_FULL } from './room-session.ts'
import type { RoomReport } from './room-session.ts'

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
  /** The invitations and games the house keeps. */
  load(): HouseData
  /** Keeps them; the host also sets its alarm for the first invitation that lapses. */
  save(data: HouseData): void
  /**
   * Makes a room of this house on the field, with these seats (the first one is its owner), and
   * answers its code; null when no room could be made. Must not throw.
   */
  makeRoom(field: Invitation['field'], seats: HouseSeat[]): Promise<string | null>
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

  async message(socketId: string, raw: unknown): Promise<void> {
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
        this.host.load(),
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

    const self = present.find(({ id }) => id === socketId)
    if (!self) {
      this.error(socketId, 'not-joined')
      return
    }
    const now = this.host.now()
    const data = this.host.load()

    if (message.type === 'choose') {
      const chosen = choose(present, self.member, message.shape, data, now)
      if (!chosen.ok) {
        this.error(socketId, chosen.error)
        return
      }
      this.host.attach(socketId, chosen.member)
      this.broadcast()
      return
    }

    const changed =
      message.type === 'invite'
        ? invite(present, data, self, message.people, message.field, now)
        : answer(data, self.member.token, message.yes)
    if (!changed.ok) {
      this.error(socketId, changed.error)
      return
    }
    this.host.save(changed.data)
    this.broadcast()
    // The last answer ends an invitation at once; otherwise the alarm does, after a minute.
    if (message.type === 'answer') await this.settle()
  }

  /**
   * Ends the invitations that are over: a room is made for those that have two players or more and
   * its players are sent there (the state says which room is theirs); for the others the one who
   * invited, and whoever said yes, hear that it is off.
   */
  async settle(): Promise<void> {
    const { data, start, off } = settle(this.host.load(), this.host.now())
    if (start.length === 0 && off.length === 0) return
    // Kept before the rooms are made, so that a message in between doesn't settle them again.
    this.host.save(data)
    for (const invitation of off) this.tell(playersOf(invitation), 'invitation-off')
    this.broadcast()
    for (const invitation of start) {
      const players = playersOf(invitation)
      const room = await this.host.makeRoom(
        invitation.field,
        players.map(({ token, name, shape }) => ({ token, name, shape })),
      )
      if (room === null) {
        this.tell(players, 'no-room')
        continue
      }
      this.host.save(gameMade(this.host.load(), invitation, room, this.host.now()))
      this.broadcast()
    }
  }

  /** A room of this house says how its round is going: the list shows who is playing. */
  report(room: string, report: RoomReport): void {
    this.host.save(reported(this.host.load(), room, report, this.host.now()))
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
    const data = this.host.load()
    const now = this.host.now()
    for (const { id } of present) {
      this.host.send(id, stateFor(present, id, this.host.code, data, now))
    }
  }

  /** Tells these people, on every socket they have open, about something that went wrong. */
  private tell(people: readonly Person[], error: HouseErrorCode): void {
    for (const { id, member } of this.present()) {
      if (people.some((person) => person.token === member.token)) this.error(id, error)
    }
  }

  private error(socketId: string, error: HouseErrorCode): void {
    this.host.send(socketId, { type: 'error', error })
  }
}
