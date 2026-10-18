import { describe, expect, it } from 'vitest'
import { DICTIONARIES } from './dictionaries.ts'
import { LANGUAGES } from './language.ts'
import { nl } from './nl.ts'
import { forms, placeholders } from './text.ts'
import type { Dictionary, MessageKey } from './types.ts'

const keys = Object.keys(nl) as MessageKey[]
const others = LANGUAGES.filter(({ id }) => id !== 'nl')

/** The placeholders of a message, whatever sentence of it: each language says the same things. */
function used(message: Dictionary[MessageKey]): string[] {
  return [...new Set(forms(message).flatMap(placeholders))].sort()
}

describe.each(others)('the texts in $name', ({ id, locale }) => {
  const dictionary = DICTIONARIES[id]

  it('has exactly the texts that Dutch has: nothing missing, nothing left over', () => {
    const own = Object.keys(dictionary)
    expect(keys.filter((key) => !own.includes(key))).toEqual([])
    expect(own.filter((key) => !keys.includes(key as MessageKey))).toEqual([])
  })

  it('has the same placeholders in every text as Dutch', () => {
    for (const key of keys) {
      expect(used(dictionary[key]), key).toEqual(used(nl[key]))
    }
  })

  it('is a plural text where Dutch is one, with a text for every category the language has', () => {
    const categories = new Intl.PluralRules(locale).resolvedOptions().pluralCategories
    for (const key of keys) {
      const message = dictionary[key]
      expect(typeof message === 'string', key).toBe(typeof nl[key] === 'string')
      if (typeof message === 'string') continue
      expect(Object.keys(message).sort(), key).toEqual([...categories].sort())
    }
  })

  it('has no empty text and no stray spaces around one', () => {
    for (const key of keys) {
      for (const text of forms(dictionary[key])) {
        expect(text.trim(), key).toBe(text)
        expect(text, key).not.toBe('')
      }
    }
  })
})

describe('the texts in Dutch', () => {
  it('are plain texts, or plural texts that have an other', () => {
    for (const key of keys) {
      const message = nl[key]
      if (typeof message === 'string') continue
      expect(Object.keys(message), key).toContain('other')
    }
  })

  it('only use the names a text can be filled in with', () => {
    for (const key of keys) {
      for (const name of used(nl[key])) expect(name, key).toMatch(/^[a-z][A-Za-z]*$/)
    }
  })
})
