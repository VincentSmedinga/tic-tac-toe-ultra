/**
 * The languages of the game, which everyone chooses for themselves: Dutch first, then English and
 * Frisian. The choice is kept per device, like the look; the first time it follows the browser's
 * languages (`navigator.languages`), and Dutch is what there is when it is none of ours.
 * public/appearance.js sets `<html lang>` and the title before the first paint; `applyLanguage`
 * keeps them up to date afterwards. Keep the two in sync (`language.test.ts` runs the script).
 *
 * A language is `reviewed` when a person who speaks it has read every text. An unreviewed language
 * is not offered, and not chosen from the browser's languages, until it is: see docs/plan.md.
 * Adding a language is one line here and one dictionary (`docs/plan.md`, Languages).
 */
export const LANGUAGES = [
  { id: 'nl', name: 'Nederlands', locale: 'nl-NL', dir: 'ltr', reviewed: true },
  { id: 'en', name: 'English', locale: 'en-GB', dir: 'ltr', reviewed: true },
  { id: 'fy', name: 'Frysk', locale: 'fy-NL', dir: 'ltr', reviewed: true },
] as const

export type LanguageId = (typeof LANGUAGES)[number]['id']

/** What the registry knows about a language. */
export interface Language {
  readonly id: LanguageId
  readonly name: string
  readonly locale: string
  readonly dir: 'ltr' | 'rtl'
  readonly reviewed: boolean
}

export const DEFAULT_LANGUAGE: LanguageId = 'nl'

export const STORAGE_KEY = 'tic-tac-toe-ultra.language'

/** The address parameter that also offers the languages nobody has read yet, to read them. */
export const PREVIEW_PARAMETER = 'alle-talen'

export function isLanguage(value: string | null): value is LanguageId {
  return LANGUAGES.some(({ id }) => id === value)
}

export function languageById(id: LanguageId) {
  const found = LANGUAGES.find((language) => language.id === id)
  if (!found) throw new RangeError(`unknown language ${id}`)
  return found
}

/**
 * The languages the picker shows: the ones that have been read, and all of them when previewing.
 * The language in use always stays in the list, so that a person who chose it can change it back.
 */
export function offeredLanguages(
  preview: boolean,
  current: LanguageId,
  languages: readonly Language[] = LANGUAGES,
) {
  return languages.filter(({ id, reviewed }) => reviewed || preview || id === current)
}

/** Whether the address asks for every language, to read the ones that are not ready. */
export function isPreview(search: string = window.location.search): boolean {
  return new URLSearchParams(search).has(PREVIEW_PARAMETER)
}

/** The first of the browser's languages that we have ("nl-BE" is Dutch), or Dutch. */
export function matchLanguage(
  tags: readonly string[],
  languages: readonly Language[] = LANGUAGES,
): LanguageId {
  for (const tag of tags) {
    const primary = tag.toLowerCase().split('-')[0]
    const found = languages.find(({ id, reviewed }) => id === primary && reviewed)
    if (found) return found.id
  }
  return DEFAULT_LANGUAGE
}

// Storage is passed in by tests; otherwise localStorage is read inside the try, because merely
// touching it throws when the browser blocks storage.

/** A stored choice, or null when there is none. */
export function savedLanguage(storage?: Storage): LanguageId | null {
  try {
    const value = (storage ?? localStorage).getItem(STORAGE_KEY)
    return isLanguage(value) ? value : null
  } catch {
    return null
  }
}

/** The choice of this device, or else the language of the browser. */
export function readLanguage(storage?: Storage, tags?: readonly string[]): LanguageId {
  return savedLanguage(storage) ?? matchLanguage(tags ?? browserLanguages())
}

function browserLanguages(): readonly string[] {
  try {
    return navigator.languages.length > 0 ? navigator.languages : [navigator.language]
  } catch {
    return []
  }
}

export function saveLanguage(language: LanguageId, storage?: Storage): void {
  try {
    ;(storage ?? localStorage).setItem(STORAGE_KEY, language)
  } catch {
    // Storage can be blocked; the choice then lasts until the page reloads.
  }
}

/**
 * The locale to format dates, numbers and lists with: the language's own where this browser knows
 * it (`fy` is not known everywhere), and Dutch, the language the game is written in, where it
 * doesn't.
 */
export function localeOf(language: LanguageId): string {
  const { locale } = languageById(language)
  return Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0
    ? locale
    : languageById(DEFAULT_LANGUAGE).locale
}
