import { OUTLINE_IDS } from '../../shared/game/index.ts'
import type { OutlineId } from '../../shared/game/index.ts'
import { FIELD_LIMITS, FIELD_PRESETS, OUTLINE_FIELDS } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import type { Text } from '../i18n/types.ts'

/**
 * What a row of this many is called: "drie op een rij". Every row a room allows is written out,
 * each as a whole text, and any other is the number in a text.
 */
export function rowLabel(t: Text, winLength: number): string {
  switch (winLength) {
    case 3:
      return t('field.inARow.3')
    case 4:
      return t('field.inARow.4')
    case 5:
      return t('field.inARow.5')
    case 6:
      return t('field.inARow.6')
    case 7:
      return t('field.inARow.7')
    case 8:
      return t('field.inARow.8')
    case 9:
      return t('field.inARow.9')
    default:
      return t('field.inARow.other', { row: winLength })
  }
}

/** What a field that is not a rectangle is called: "Piramide". */
export function outlineName(t: Text, outline: OutlineId): string {
  return t(`field.outline.${outline}`)
}

/**
 * "7 × 7, vijf op een rij": how big the field is and how many in a row win. A field with an outline
 * has its name instead of the size of the box around it: "Piramide, vijf op een rij".
 */
export function fieldLabel(t: Text, { width, height, winLength, outline }: FieldSettings): string {
  const row = rowLabel(t, winLength)
  return outline === undefined
    ? t('field.label', { width, height, row })
    : t('field.outlineLabel', { name: outlineName(t, outline), row })
}

export function isClassic({ width, height, winLength, outline }: FieldSettings): boolean {
  return width === 3 && height === 3 && winLength === 3 && outline === undefined
}

/** The ready-made fields of the picker: the rectangles, and the fields with an outline. */
export const READY_FIELDS = [
  ...FIELD_PRESETS,
  ...OUTLINE_IDS.map((id) => ({ id, ...OUTLINE_FIELDS[id] })),
]

/** The id of the ready-made field that is exactly this one, or null for a field of your own. */
export function presetOf(field: FieldSettings): string | null {
  const found = READY_FIELDS.find(
    (ready) =>
      ready.width === field.width &&
      ready.height === field.height &&
      ready.winLength === field.winLength &&
      ready.outline === field.outline,
  )
  return found?.id ?? null
}

/** The longest row a field can have: within the limits, and no longer than its longest side. */
export function longestRow({ width, height }: Pick<FieldSettings, 'width' | 'height'>): number {
  return Math.min(FIELD_LIMITS.maxWin, Math.max(width, height))
}

/** Every number in a row that fits on a field of this size, the shortest first. */
export function rowChoices(size: Pick<FieldSettings, 'width' | 'height'>): number[] {
  const { minWin } = FIELD_LIMITS
  return Array.from({ length: longestRow(size) - minWin + 1 }, (_, index) => minWin + index)
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
