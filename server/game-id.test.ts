import { describe, expect, it } from 'vitest'
import { gameIdSchema } from '../shared/protocol.ts'
import { newGameId } from './game-id.ts'

describe('newGameId', () => {
  it('makes ids the protocol accepts', () => {
    for (let i = 0; i < 200; i++) expect(gameIdSchema.safeParse(newGameId()).success).toBe(true)
  })

  it('never makes the same id twice', () => {
    const ids = new Set(Array.from({ length: 1000 }, newGameId))
    expect(ids.size).toBe(1000)
  })
})
