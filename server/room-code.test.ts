import { describe, expect, it } from 'vitest'
import { roomCodeSchema } from '../shared/protocol.ts'
import { ROOM_CODE_ALPHABET } from '../shared/room.ts'
import { newRoomCode } from './room-code.ts'

describe('newRoomCode', () => {
  it('makes codes that are valid room codes', () => {
    for (let i = 0; i < 500; i++) expect(roomCodeSchema.safeParse(newRoomCode()).success).toBe(true)
  })

  it('uses every letter, and about equally often', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 20_000; i++) {
      for (const letter of newRoomCode()) counts.set(letter, (counts.get(letter) ?? 0) + 1)
    }
    expect([...counts.keys()].sort().join('')).toBe(ROOM_CODE_ALPHABET.split('').sort().join(''))
    // 80,000 letters over 20 means 4,000 each; a biased pick would be far off.
    for (const count of counts.values()) expect(Math.abs(count - 4000)).toBeLessThan(400)
  })
})
