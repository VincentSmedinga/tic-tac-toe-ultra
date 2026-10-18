import { shapeById } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'

const DECIMALS = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 })
const SHORT_DATE = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** A number the Dutch way, with at most one decimal: 6,3. */
export function decimal(value: number): string {
  return DECIMALS.format(value)
}

/** "56%" of a part of a whole; nothing to divide by gives "0%". */
export function percent(part: number, whole: number): string {
  return `${Math.round(whole === 0 ? 0 : (part / whole) * 100).toString()}%`
}

/** How long, to the second and no finer: "45 s", "2 min 5 s", "1 u 5 min". */
export function duration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds.toString()} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    const rest = seconds % 60
    return rest === 0
      ? `${minutes.toString()} min`
      : `${minutes.toString()} min ${rest.toString()} s`
  }
  const hours = Math.floor(minutes / 60)
  const left = minutes % 60
  return left === 0 ? `${hours.toString()} u` : `${hours.toString()} u ${left.toString()} min`
}

/** "12 okt": a day of a week's start, which comes as YYYY-MM-DD. */
export function shortDate(date: string): string {
  return SHORT_DATE.format(new Date(`${date}T00:00:00Z`)).replace('.', '')
}

/** "1 spel", "3 spellen". */
export function games(count: number): string {
  return `${count.toString()} ${count === 1 ? 'spel' : 'spellen'}`
}

/** The name of a shape with a capital: "Kruis". */
export function shapeName(shape: ShapeId): string {
  const { name } = shapeById(shape)
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Where a cell is, counting from 1 as people do: "rij 2, kolom 3". */
export function cellName(x: number, y: number): string {
  return `rij ${(y + 1).toString()}, kolom ${(x + 1).toString()}`
}

/** A kind of game in words: "3 bij 3, 3 op een rij". */
export function kindName(width: number, height: number, winLength: number): string {
  return `${width.toString()} bij ${height.toString()}, ${winLength.toString()} op een rij`
}
