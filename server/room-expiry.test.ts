import { describe, expect, it } from 'vitest'
import { EXPIRES_AFTER_MS, mayGo } from './room-expiry.ts'

const quiet = { queued: 0, connected: false, asked: false, idleMs: 0 }

describe('mayGo', () => {
  it('keeps a room that is used', () => {
    expect(mayGo(quiet)).toBe(false)
    expect(mayGo({ ...quiet, idleMs: EXPIRES_AFTER_MS - 1 })).toBe(false)
  })

  it('lets a room go after a day without anyone', () => {
    expect(mayGo({ ...quiet, idleMs: EXPIRES_AFTER_MS })).toBe(true)
  })

  it('lets a room go at once when everybody has left', () => {
    expect(mayGo({ ...quiet, asked: true })).toBe(true)
  })

  it('never lets a room go while a game waits for the archive', () => {
    expect(mayGo({ ...quiet, asked: true, queued: 1 })).toBe(false)
    expect(mayGo({ ...quiet, idleMs: EXPIRES_AFTER_MS, queued: 2 })).toBe(false)
  })

  it('never lets a room go while a socket is open', () => {
    expect(mayGo({ ...quiet, asked: true, connected: true })).toBe(false)
    expect(mayGo({ ...quiet, idleMs: EXPIRES_AFTER_MS, connected: true })).toBe(false)
  })
})
