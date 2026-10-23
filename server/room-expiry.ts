/** A room that nobody has touched for this long is deleted, with everything in it. */
export const EXPIRES_AFTER_MS = 24 * 60 * 60 * 1000

/** What the room's alarm knows when it decides whether the room goes. */
export interface Standing {
  /** Finished games that the archive hasn't confirmed yet. */
  queued: number
  /** Whether a socket is open. */
  connected: boolean
  /** Everybody has left, and the room was asked to go. */
  asked: boolean
  /** How long ago the room was last touched, in milliseconds. */
  idleMs: number
}

/**
 * Whether the room is deleted now: never while a game waits for the archive or someone is
 * connected, and otherwise when everybody has left or when nobody has touched it for a day.
 */
export function mayGo({ queued, connected, asked, idleMs }: Standing): boolean {
  if (queued > 0 || connected) return false
  return asked || idleMs >= EXPIRES_AFTER_MS
}
