import { SHAPE_IDS } from './shapes.ts'

/**
 * A house ("Huis", the lobby of other games): one place for an evening, where the family sees who
 * is there. Its code is six digits, so that one field on the start screen can tell it from a room's
 * four consonants; six and not four because a house shows the names of the family, and four digits
 * are quickly guessed (docs/plan.md, House).
 */
export const HOUSE_CODE_LENGTH = 6
export const HOUSE_CODE_PATTERN = new RegExp(`^\\d{${HOUSE_CODE_LENGTH.toString()}}$`)

/**
 * How many people a house holds at once: one for every shape, since two people in a house never
 * have the same one.
 */
export const HOUSE_LIMIT = SHAPE_IDS.length

/** What a person in the house is doing; playing and watching come with inviting and guests. */
export const MEMBER_STATUSES = ['free', 'playing', 'watching'] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]

/**
 * The number that tells people with the same name apart, for each name in the order the people
 * came in: none for the first, 2 for the second, 3 for the third. Names are the same when they
 * only differ in capitals.
 */
export function nameNumbers(names: readonly string[]): (number | undefined)[] {
  const seen = new Map<string, number>()
  return names.map((name) => {
    const key = name.toLocaleLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? undefined : count
  })
}
