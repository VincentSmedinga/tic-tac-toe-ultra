import { useSyncExternalStore } from 'react'
import { DICTIONARIES } from './dictionaries.ts'
import { languageById, localeOf, readLanguage, saveLanguage } from './language.ts'
import type { LanguageId } from './language.ts'
import { makeText } from './text.ts'
import type { Text } from './types.ts'

/**
 * The language of this page, one for the whole app so that no component needs a provider (a
 * test or a story just renders it). Like the animations switch it is read from storage the first
 * time, remembered here when storage is blocked, and every screen that shows it follows a change.
 */
let current: LanguageId | undefined
const listeners = new Set<() => void>()

export function getLanguage(): LanguageId {
  current ??= readLanguage()
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** `<html lang>`, `dir` and the title of the page, which also say the language to the browser. */
export function applyLanguage(
  language: LanguageId,
  root: HTMLElement = document.documentElement,
): void {
  root.lang = language
  root.dir = languageById(language).dir
  document.title = DICTIONARIES[language]['app.title'] as string
}

/** Changes the language for this device and every screen that shows one, and keeps the choice. */
export function setLanguage(language: LanguageId): void {
  current = language
  saveLanguage(language)
  applyLanguage(language)
  for (const listener of listeners) listener()
}

/** Forgets what was remembered, so the next read starts from storage again (tests). */
export function resetLanguage(): void {
  current = undefined
  for (const listener of listeners) listener()
}

export function useLanguage(): LanguageId {
  return useSyncExternalStore(subscribe, getLanguage)
}

const texts = new Map<LanguageId, Text>()

/** The text function of a language; one is made once per language. */
export function textFor(language: LanguageId): Text {
  let found = texts.get(language)
  if (!found) {
    found = makeText(DICTIONARIES[language], localeOf(language))
    texts.set(language, found)
  }
  return found
}

/** `const t = useText()`: gives the texts in the language of the page, `t('status.won', { name })`. */
export function useText(): Text {
  return textFor(useLanguage())
}
