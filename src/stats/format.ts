import type { Text } from '../i18n/types.ts'

/** How long, to the second and no finer: "45 s", "2 min 5 s", "1 u 5 min". */
export function duration(t: Text, milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return t('duration.seconds', { seconds })
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0
      ? t('duration.minutes', { minutes })
      : t('duration.minutesSeconds', { minutes, seconds: rest })
  }
  const hours = Math.floor(minutes / 60)
  const left = minutes % 60
  return left === 0
    ? t('duration.hours', { hours })
    : t('duration.hoursMinutes', { hours, minutes: left })
}

/** Where a cell is, counting from 1 as people do: "rij 2, kolom 3". */
export function cellName(t: Text, x: number, y: number): string {
  return t('stats.cell', { row: y + 1, column: x + 1 })
}
