/**
 * A random generator that can be given a seed: the same seed gives the same numbers, so a test, and
 * later a replay, can fix what would otherwise be chance. Mulberry32, which is small and good
 * enough for picking a stroke order; it is not for anything secret.
 */
export type Random = () => number

/** Mixes whole numbers into one 32-bit seed, so that (3, 0) and (0, 3) do not give the same game. */
export function seedFrom(...parts: readonly number[]): number {
  let hash = 0x811c9dc5
  for (const part of parts) {
    hash = Math.imul(hash ^ (part | 0), 0x01000193)
    hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d)
  }
  return hash >>> 0
}

/** A generator that gives numbers in [0, 1). */
export function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A number between `low` and `high`. */
export function between(random: Random, low: number, high: number): number {
  return low + random() * (high - low)
}

/** One of the items. */
export function oneOf<T>(random: Random, items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)]
  if (item === undefined) throw new RangeError('nothing to pick from')
  return item
}

/** The items in a random order (Fisher–Yates), the original untouched. */
export function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}

/** A seed for a game that has none yet. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296)
}
