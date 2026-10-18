/**
 * Who this browser is, kept in its localStorage: a token that the room knows a player by when
 * they come back, and the name they last typed. localStorage can be off (a private window, blocked
 * site data), so everything falls back to memory, and the game works without it.
 */

import { MAX_NAME_LENGTH, tokenSchema } from '../../shared/protocol.ts'

const TOKEN_KEY = 'tic-tac-toe-ultra.token'
const NAME_KEY = 'tic-tac-toe-ultra.name'

let memoryToken: string | null = null
let memoryName = ''

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
