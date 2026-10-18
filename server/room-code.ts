import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../shared/room.ts'

/** A new room code. The alphabet has 20 letters, so a random byte from 240 up is skipped: no letter is likelier. */
export function newRoomCode(): string {
  const limit = 256 - (256 % ROOM_CODE_ALPHABET.length)
  let code = ''
  while (code.length < ROOM_CODE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH * 2))
    for (const byte of bytes) {
      if (byte < limit && code.length < ROOM_CODE_LENGTH) {
        code += ROOM_CODE_ALPHABET.charAt(byte % ROOM_CODE_ALPHABET.length)
      }
    }
  }
  return code
}
