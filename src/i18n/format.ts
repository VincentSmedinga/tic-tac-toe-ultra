import { useMemo } from 'react'
import { localeOf } from './language.ts'
import type { LanguageId } from './language.ts'
import { useLanguage } from './store.ts'

/** Dates, numbers and lists in the language of the page. */
export interface Format {
  locale: string
  /** "12 okt 2026, 14:05": a moment, in the browser's time zone. */
  dateTime: (when: number | Date, dateStyle: 'medium' | 'long') => string
  /** "12 okt": a day that comes as YYYY-MM-DD, whatever the time zone. */
  shortDate: (date: string) => string
  /** The name of a day of the week: 0 is Monday. */
  weekday: (index: number, style: 'long' | 'short') => string
  /** "56%" of a part of a whole; nothing to divide by gives "0%". */
  percent: (part: number, whole: number) => string
  /** "Anna, Bo en Cas": names in a row, with the word for "and" of the language. */
  list: (items: readonly string[]) => string
}

// A Monday in UTC: the days of the week are the ones the server counted, in Dutch time.
const MONDAY = Date.UTC(2024, 0, 1)
const DAY = 86_400_000

export function makeFormat(language: LanguageId): Format {
  const locale = localeOf(language)
  return {
    locale,
    dateTime: (when, dateStyle) =>
      new Intl.DateTimeFormat(locale, { dateStyle, timeStyle: 'short' }).format(when),
    shortDate: (date) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${date}T00:00:00Z`))
        .replace('.', ''),
    weekday: (index, style) =>
      new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' })
        .format(MONDAY + index * DAY)
        .replace('.', ''),
    percent: (part, whole) =>
      new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
        whole === 0 ? 0 : part / whole,
      ),
    list: (items) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items),
  }
}

export function useFormat(): Format {
  const language = useLanguage()
  return useMemo(() => makeFormat(language), [language])
}
