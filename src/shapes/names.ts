import { localeOf } from '../i18n/language.ts'
import { useLanguage } from '../i18n/store.ts'
import { textFor } from '../i18n/store.ts'
import type { LanguageId } from '../i18n/language.ts'
import type { ShapeId } from './shapes.ts'

/** What the shapes are called in a language. */
export interface ShapeNames {
  /** As it is said in the middle of a sentence: "kruis". */
  name: (id: ShapeId) => string
  /** With a capital, to start a sentence or stand alone: "Kruis". */
  title: (id: ShapeId) => string
}

export function shapeNamesFor(language: LanguageId): ShapeNames {
  const t = textFor(language)
  const locale = localeOf(language)
  const name = (id: ShapeId) => t(`shape.${id}`)
  return {
    name,
    title: (id) => {
      const text = name(id)
      const [first = ''] = text
      return first.toLocaleUpperCase(locale) + text.slice(first.length)
    },
  }
}

/** The names of the shapes in the language of the page. */
export function useShapeNames(): ShapeNames {
  return shapeNamesFor(useLanguage())
}
