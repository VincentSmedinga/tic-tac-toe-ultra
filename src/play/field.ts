import { FIELD_LIMITS, FIELD_PRESETS } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'

/** What a row of this many is called: "drie op een rij". Every row a room allows is odd. */
const ROW_WORDS: Readonly<Record<number, string>> = {
  3: 'drie',
  5: 'vijf',
  7: 'zeven',
  9: 'negen',
}

/** "7 × 7, vijf op een rij": how big the field is and how many in a row win. */
export function fieldLabel({ width, height, winLength }: FieldSettings): string {
  const row = ROW_WORDS[winLength] ?? winLength.toString()
  return `${width.toString()} × ${height.toString()}, ${row} op een rij`
}

export function isClassic(field: FieldSettings): boolean {
  return field.width === 3 && field.height === 3 && field.winLength === 3
}

/** The id of the preset that is exactly this field, or null for a field of your own. */
export function presetOf(field: FieldSettings): string | null {
  const found = FIELD_PRESETS.find(
    (preset) =>
      preset.width === field.width &&
      preset.height === field.height &&
      preset.winLength === field.winLength,
  )
  return found?.id ?? null
}

/** The longest row a field can have: odd, within the limits, and no longer than its longest side. */
export function longestRow({ width, height }: Pick<FieldSettings, 'width' | 'height'>): number {
  const reach = Math.min(FIELD_LIMITS.maxWin, Math.max(width, height))
  return reach % 2 === 1 ? reach : reach - 1
}

/**
 * The row that makes a good game on a field of this size, which the field picker suggests: five in
 * a row, the classic, as soon as the field is big enough for it (three on a field of three), and
 * seven on the biggest fields, where five would be too easy for whoever starts. It follows the
 * smaller side: on a narrow field the long side doesn't make the game any harder.
 */
export function suggestedRow({ width, height }: Pick<FieldSettings, 'width' | 'height'>): number {
  const side = Math.min(width, height)
  const wanted = side >= 17 ? 7 : Math.min(5, side)
  return Math.min(wanted, longestRow({ width, height }))
}
