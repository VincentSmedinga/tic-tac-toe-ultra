import { HOUSE_LIMIT, nameNumbers } from '../shared/house.ts'
import type { HouseErrorCode, HouseState } from '../shared/house-protocol.ts'
import type { ShapeId } from '../shared/shapes.ts'

/**
 * The rules of a house, as functions on the people who have it open: pure, so that they are tested
 * without Cloudflare. A house keeps nobody who isn't there: a person is a socket that has joined,
 * and who is in the house is who has it open (docs/architecture/house.md).
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

export type Joined = { ok: true; member: Member } | { ok: false; error: HouseErrorCode }

/** The people in the house apart from this browser (which may be on another socket too). */
function others(present: readonly Present[], token: string): Present[] {
  return present.filter(({ member }) => member.token !== token)
}

function holds(present: readonly Present[], shape: ShapeId): boolean {
  return present.some(({ member }) => member.shape === shape)
}

/**
 * Somebody comes in, or says their name again. The shape they ask for is theirs when nobody else
 * has it; otherwise they keep the one they have on another socket, or have none and choose. A
 * browser that is there already keeps its place in the list.
 */
export function join(
  present: readonly Present[],
  token: string,
  name: string,
  shape: ShapeId | undefined,
  now: number,
): Joined {
  const rest = others(present, token)
  const before = present.find(({ member }) => member.token === token)?.member
  if (!before && new Set(rest.map(({ member }) => member.token)).size >= HOUSE_LIMIT) {
    return { ok: false, error: 'house-full' }
  }
  const wanted = shape !== undefined && !holds(rest, shape) ? shape : undefined
  const kept = before?.shape !== undefined && !holds(rest, before.shape) ? before.shape : undefined
  const chosen = wanted ?? kept
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

/** Somebody chooses a shape: theirs, unless somebody else in the house has it. */
export function choose(present: readonly Present[], member: Member, shape: ShapeId): Joined {
  if (holds(others(present, member.token), shape)) return { ok: false, error: 'shape-taken' }
  return { ok: true, member: { ...member, shape } }
}

/**
 * The house as the one on socket `you` sees it: everybody once (a browser with two sockets is one
 * person), in the order they came in, with a number after a name that somebody before them has.
 */
export function stateFor(present: readonly Present[], you: string, code: string): HouseState {
  const seen = new Set<string>()
  const people = [...present]
    .sort((a, b) => a.member.since - b.member.since || a.id.localeCompare(b.id))
    .filter(({ member }) => {
      if (seen.has(member.token)) return false
      seen.add(member.token)
      return true
    })
  const mine = present.find(({ id }) => id === you)?.member.token
  const numbers = nameNumbers(people.map(({ member }) => member.name))
  return {
    type: 'state',
    code,
    // The socket of this browser that is in the list, which is this one unless there are two.
    you: people.find(({ member }) => member.token === mine)?.id ?? you,
    members: people.map(({ id, member }, index) => {
      const number = numbers[index]
      return {
        id,
        name: member.name,
        ...(number === undefined ? {} : { number }),
        ...(member.shape === undefined ? {} : { shape: member.shape }),
        status: 'free',
      }
    }),
  }
}
