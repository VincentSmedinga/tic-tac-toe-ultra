import { HOUSE_LIMIT, INVITATION_MS, nameNumbers } from '../shared/house.ts'
import type { Answer, MemberStatus } from '../shared/house.ts'
import type { HouseErrorCode, HouseState } from '../shared/house-protocol.ts'
import type { FieldSettings } from '../shared/room.ts'
import type { ShapeId } from '../shared/shapes.ts'
import { EXPIRES_AFTER_MS } from './room-expiry.ts'
import type { RoomReport } from './room-session.ts'

/**
 * The rules of a house, as functions on the people who have it open and on what the house keeps
 * (its invitations and its games): pure, so that they are tested without Cloudflare. Who is in the
 * house is who has it open, plus the people of its invitations and of the rounds being played in its
 * rooms, who may have the house closed (docs/architecture/house.md).
 */

/** Who a person is in the house; kept with their socket, so it survives the house sleeping. */
export interface Member {
  token: string
  name: string
  shape?: ShapeId
  /** When this person came in, in milliseconds since 1970: the order of the list. */
  since: number
}

/** A socket of the house and, once it has joined, who is on it. */
export interface Present {
  id: string
  member: Member
}

/**
 * A person as an invitation or a game keeps them: who they were in the house when they were
 * invited, with the id they had in its list then.
 */
export interface Person {
  token: string
  id: string
  name: string
  shape: ShapeId
}

/** An invitation to a game: from one person to others, who answer within a minute. */
export interface Invitation {
  from: Person
  field: FieldSettings
  invited: (Person & { answer: Answer })[]
  /** When it is over by itself, in milliseconds since 1970. */
  lapses: number
}

/** A room the house made, and what it last heard about its round. */
export interface HouseGame {
  room: string
  field: FieldSettings
  round: number
  /** Who plays this round, the one who invited first. */
  players: Person[]
  /** Set once the round is over: the winner (a shape), or null for a draw. */
  over?: { winner: string | null }
  /** When the house last heard from the room. */
  heard: number
}

/** What a house keeps in its storage, besides its code. */
export interface HouseData {
  invitations: Invitation[]
  games: HouseGame[]
}

export const EMPTY_HOUSE: HouseData = { invitations: [], games: [] }

/** How many games a house remembers: the newest ones. */
export const GAMES_KEPT = 50

export type Joined = { ok: true; member: Member } | { ok: false; error: HouseErrorCode }
export type Changed = { ok: true; data: HouseData } | { ok: false; error: HouseErrorCode }

/**
 * Whether a round is being played in this room: the room hasn't said it is over, and has said
 * something within a day (a room nobody plays in is gone after a day).
 */
function isRunning(game: HouseGame, now: number): boolean {
  return game.over === undefined && now - game.heard < EXPIRES_AFTER_MS
}

/** The people an invitation still holds: the one who invited, and those who didn't say no. */
function bound(invitation: Invitation): Person[] {
  return [invitation.from, ...invitation.invited.filter(({ answer }) => answer !== 'no')]
}

/** The people the house keeps besides those who have it open: invited, inviting or playing. */
function kept(data: HouseData, now: number): Person[] {
  return [
    ...data.invitations.flatMap(bound),
    ...data.games.filter((game) => isRunning(game, now)).flatMap(({ players }) => players),
  ]
}

/** Everybody in the house with the shape they have: those who have it open and those it keeps. */
function occupants(
  present: readonly Present[],
  data: HouseData,
  now: number,
): { token: string; shape?: ShapeId | undefined }[] {
  return [...present.map(({ member }) => member), ...kept(data, now)]
}

/** What this person is doing in the house. */
export function statusOf(data: HouseData, token: string, now: number): MemberStatus {
  const playing = data.games.some(
    (game) => isRunning(game, now) && game.players.some((player) => player.token === token),
  )
  if (playing) return 'playing'
  if (data.invitations.some(({ from }) => from.token === token)) return 'inviting'
  const invited = data.invitations.some(({ invited }) =>
    invited.some((person) => person.token === token && person.answer !== 'no'),
  )
  return invited ? 'invited' : 'free'
}

/**
 * Somebody comes in, or says their name again. The shape they ask for is theirs when nobody else
 * has it; otherwise they keep the one they have on another socket, or in a game or an invitation of
 * the house, or have none and choose. A browser that is there already keeps its place in the list.
 */
export function join(
  present: readonly Present[],
  token: string,
  name: string,
  shape: ShapeId | undefined,
  now: number,
  data: HouseData = EMPTY_HOUSE,
): Joined {
  const rest = occupants(present, data, now).filter((person) => person.token !== token)
  const before = present.find(({ member }) => member.token === token)?.member
  if (!before && new Set(rest.map((person) => person.token)).size >= HOUSE_LIMIT) {
    return { ok: false, error: 'house-full' }
  }
  const holds = (candidate: ShapeId) => rest.some((person) => person.shape === candidate)
  const had = before?.shape ?? kept(data, now).find((person) => person.token === token)?.shape
  const wanted = shape !== undefined && !holds(shape) ? shape : undefined
  const keptShape = had !== undefined && !holds(had) ? had : undefined
  const chosen = wanted ?? keptShape
  return {
    ok: true,
    member: {
      token,
      name,
      ...(chosen === undefined ? {} : { shape: chosen }),
      since: before?.since ?? now,
    },
  }
}

/**
 * Somebody chooses a shape: theirs, unless somebody else in the house has it. Only somebody free
 * can: an invitation and a game are played with the shape someone had when they were invited.
 */
export function choose(
  present: readonly Present[],
  member: Member,
  shape: ShapeId,
  data: HouseData = EMPTY_HOUSE,
  now = 0,
): Joined {
  if (statusOf(data, member.token, now) !== 'free') return { ok: false, error: 'not-free' }
  const rest = occupants(present, data, now).filter((person) => person.token !== member.token)
  if (rest.some((person) => person.shape === shape)) return { ok: false, error: 'shape-taken' }
  return { ok: true, member: { ...member, shape } }
}

/**
 * The people in the list, each once: those who have the house open in the order they came in (a
 * browser with two sockets is one person, with the id of its first socket), then those the house
 * keeps who don't have it open.
 */
function everyone(
  present: readonly Present[],
  data: HouseData,
  now: number,
): { id: string; token: string; name: string; shape?: ShapeId | undefined }[] {
  const seen = new Set<string>()
  const once = (person: { token: string }) => {
    if (seen.has(person.token)) return false
    seen.add(person.token)
    return true
  }
  const open = [...present]
    .sort((a, b) => a.member.since - b.member.since || a.id.localeCompare(b.id))
    .map(({ id, member }) => ({ ...member, id }))
    .filter(once)
  return [...open, ...kept(data, now).filter(once)]
}

/** A person someone invites: somebody who has the house open, by the id the list shows. */
function invitee(present: readonly Present[], id: string): Present | undefined {
  return present.find((candidate) => candidate.id === id)
}

/**
 * Somebody invites others to a game on a field. Everybody in it must be free and have a shape, so
 * that the room can be made with the shapes of the house; the invitation runs for a minute.
 */
export function invite(
  present: readonly Present[],
  data: HouseData,
  from: Present,
  ids: readonly string[],
  field: FieldSettings,
  now: number,
): Changed {
  const people: Present[] = []
  for (const id of ids) {
    const found = invitee(present, id)
    if (!found || found.member.token === from.member.token) return { ok: false, error: 'not-free' }
    if (!people.some(({ member }) => member.token === found.member.token)) people.push(found)
  }
  // Everybody must be free and have a shape: the room is played with the shapes of the house.
  const asPerson = ({ id, member }: Present): Person | HouseErrorCode => {
    if (statusOf(data, member.token, now) !== 'free') return 'not-free'
    if (member.shape === undefined) return 'shape-needed'
    return { token: member.token, id, name: member.name, shape: member.shape }
  }
  const inviter = asPerson(from)
  if (typeof inviter === 'string') return { ok: false, error: inviter }
  const invited: Invitation['invited'] = []
  for (const person of people) {
    const found = asPerson(person)
    if (typeof found === 'string') return { ok: false, error: found }
    invited.push({ ...found, answer: 'open' })
  }
  const invitation: Invitation = { from: inviter, field, invited, lapses: now + INVITATION_MS }
  return { ok: true, data: { ...data, invitations: [...data.invitations, invitation] } }
}

/** Somebody answers the invitation they have not answered yet. */
export function answer(data: HouseData, token: string, yes: boolean): Changed {
  const open = (invitation: Invitation) =>
    invitation.invited.some((person) => person.token === token && person.answer === 'open')
  if (!data.invitations.some(open)) return { ok: false, error: 'no-invitation' }
  const answered: Answer = yes ? 'yes' : 'no'
  return {
    ok: true,
    data: {
      ...data,
      invitations: data.invitations.map((invitation) =>
        open(invitation)
          ? {
              ...invitation,
              invited: invitation.invited.map((person) =>
                person.token === token ? { ...person, answer: answered } : person,
              ),
            }
          : invitation,
      ),
    },
  }
}

/** Who plays when an invitation is over: the one who invited, then those who said yes. */
export function playersOf(invitation: Invitation): Person[] {
  return [invitation.from, ...invitation.invited.filter(({ answer }) => answer === 'yes')]
}

/**
 * The invitations that are over, because everybody has answered or the minute is up: a room is
 * made for those with at least two players (`start`), the others are off. The house keeps only the
 * invitations that are still running.
 */
export function settle(
  data: HouseData,
  now: number,
): { data: HouseData; start: Invitation[]; off: Invitation[] } {
  const done = (invitation: Invitation) =>
    invitation.lapses <= now || invitation.invited.every(({ answer }) => answer !== 'open')
  const over = data.invitations.filter(done)
  return {
    data: { ...data, invitations: data.invitations.filter((invitation) => !done(invitation)) },
    start: over.filter((invitation) => playersOf(invitation).length >= 2),
    off: over.filter((invitation) => playersOf(invitation).length < 2),
  }
}

/** The room for an invitation is made: its first round is being played. */
export function gameMade(
  data: HouseData,
  invitation: Invitation,
  room: string,
  now: number,
): HouseData {
  const game: HouseGame = {
    room,
    field: invitation.field,
    round: 0,
    players: playersOf(invitation),
    heard: now,
  }
  return { ...data, games: [...data.games, game].slice(-GAMES_KEPT) }
}

/** A room of the house says a round is over, or that the next one has started. */
export function reported(
  data: HouseData,
  room: string,
  report: RoomReport,
  now: number,
): HouseData {
  return {
    ...data,
    games: data.games.map((game): HouseGame => {
      if (game.room !== room) return game
      if (report.kind === 'over') {
        return { ...game, round: report.round, over: { winner: report.winner }, heard: now }
      }
      return {
        room: game.room,
        field: game.field,
        round: report.round,
        players: game.players.filter((player) => report.playing.includes(player.token)),
        heard: now,
      }
    }),
  }
}

/**
 * The house as the one on socket `you` sees it: everybody once, with a number after a name that
 * somebody before them has, what each is doing, the invitation this person is part of and the room
 * of the round they play.
 */
export function stateFor(
  present: readonly Present[],
  you: string,
  code: string,
  data: HouseData = EMPTY_HOUSE,
  now = 0,
): HouseState {
  const people = everyone(present, data, now)
  const mine = present.find(({ id }) => id === you)?.member.token
  const numbers = nameNumbers(people.map(({ name }) => name))
  const idOf = (person: Person) =>
    people.find(({ token }) => token === person.token)?.id ?? person.id

  const invitation = data.invitations.find(
    (candidate) =>
      candidate.from.token === mine ||
      candidate.invited.some((person) => person.token === mine && person.answer !== 'no'),
  )
  const room = data.games.findLast(
    (game) => isRunning(game, now) && game.players.some((player) => player.token === mine),
  )?.room

  return {
    type: 'state',
    code,
    // The socket of this browser that is in the list, which is this one unless there are two.
    you: people.find(({ token }) => token === mine)?.id ?? you,
    members: people.map(({ id, token, name, shape }, index) => {
      const number = numbers[index]
      return {
        id,
        name,
        ...(number === undefined ? {} : { number }),
        ...(shape === undefined ? {} : { shape }),
        status: statusOf(data, token, now),
      }
    }),
    ...(invitation === undefined
      ? {}
      : {
          invitation: {
            from: idOf(invitation.from),
            field: { ...invitation.field },
            people: invitation.invited.map((person) => ({
              id: idOf(person),
              answer: person.answer,
            })),
          },
        }),
    ...(room === undefined ? {} : { room }),
  }
}
