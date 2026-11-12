import { describe, expect, it } from 'vitest'
import { houseCodeSchema } from '../shared/house-protocol.ts'
import { newHouseCode } from './house-code.ts'

describe('a new house code', () => {
  it('is six digits, and not the same every time', () => {
    const codes = Array.from({ length: 50 }, newHouseCode)
    for (const code of codes) expect(houseCodeSchema.safeParse(code).success).toBe(true)
    expect(new Set(codes).size).toBeGreaterThan(40)
  })
})
