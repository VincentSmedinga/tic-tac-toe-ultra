/**
 * Who this browser is, kept in its localStorage: a token that the room knows a player by when
 * they come back, and the name they last typed. localStorage can be off (a private window, blocked
 * site data), so everything falls back to memory, and the game works without it.
 */

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
      if (token === null) {
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
  memoryName = name
  try {
    storage()?.setItem(NAME_KEY, name)
  } catch {
    // Not remembered, but it still counts for this visit.
  }
}
