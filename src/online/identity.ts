/**
 * Who this browser is, kept in its localStorage: a token that the room knows a player by when
 * they come back, and the name they last typed. localStorage can be off (a private window, blocked
 * site data), so everything falls back to memory, and the game works without it.
 */

import { MAX_NAME_LENGTH, roomCodeSchema, tokenSchema } from '../../shared/protocol.ts'

const TOKEN_KEY = 'tic-tac-toe-ultra.token'
const NAME_KEY = 'tic-tac-toe-ultra.name'
const ROOM_KEY = 'tic-tac-toe-ultra.room'

let memoryToken: string | null = null
let memoryName = ''
let memoryRoom: string | null = null

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The token of this browser; made the first time it is asked for. */
export function getToken(): string {
  const store = storage()
  if (store) {
    try {
      let token = store.getItem(TOKEN_KEY)
      // Whatever is in storage may be anything: a token the room would refuse is made again.
      if (token === null || !tokenSchema.safeParse(token).success) {
        token = crypto.randomUUID()
        store.setItem(TOKEN_KEY, token)
      }
      return token
    } catch {
      // Reading or writing failed after all: carry on without.
    }
  }
  memoryToken ??= crypto.randomUUID()
  return memoryToken
}

/**
 * A name as the room accepts it: no control, invisible or unassigned characters (a pasted
 * zero-width space, say), no spaces around it, and not longer than a name may be (cut between
 * characters, never in the middle of one).
 */
export function sanitizeName(name: string): string {
  let result = ''
  for (const character of name.replace(/\p{C}/gu, '').trim()) {
    if ((result + character).length > MAX_NAME_LENGTH) break
    result += character
  }
  return result.trim()
}

export function getName(): string {
  const store = storage()
  if (store) {
    try {
      return store.getItem(NAME_KEY) ?? ''
    } catch {
      // Fall back to what was typed this visit.
    }
  }
  return memoryName
}

export function setName(name: string): void {
  const clean = sanitizeName(name)
  memoryName = clean
  try {
    storage()?.setItem(NAME_KEY, clean)
  } catch {
    // Not remembered, but it still counts for this visit.
  }
}

/** The room this browser last sat in, so that the start screen can offer to go back to it. */
export function getLastRoom(): string | null {
  const store = storage()
  let code = memoryRoom
  if (store) {
    try {
      code = store.getItem(ROOM_KEY)
    } catch {
      // Fall back to what was remembered this visit.
    }
  }
  return code !== null && roomCodeSchema.safeParse(code).success ? code : null
}

export function setLastRoom(code: string): void {
  memoryRoom = code
  try {
    storage()?.setItem(ROOM_KEY, code)
  } catch {
    // Not remembered, but it still counts for this visit.
  }
}

/** The room is gone, or full, or was left for good: it is no use to offer it again. */
export function clearLastRoom(): void {
  memoryRoom = null
  try {
    storage()?.removeItem(ROOM_KEY)
  } catch {
    // Nothing to clear.
  }
}
