import { GAME_ID_LENGTH } from '../shared/protocol.ts'

/** A new id for a stored game: 96 random bits as URL-safe characters, so nobody can guess one. */
export function newGameId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array((GAME_ID_LENGTH / 4) * 3))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}
