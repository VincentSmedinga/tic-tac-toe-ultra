import { DICTIONARIES } from './dictionaries.ts'
import type { LanguageId } from './language.ts'
import { forms } from './text.ts'
import type { MessageKey } from './types.ts'

/** Every text a person can read in what is on the screen: the text itself, and the labels and titles. */
export function visibleTexts(root: ParentNode = document.body): string[] {
  const texts: string[] = []
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute(attribute)
      if (value) texts.push(value)
    }
    for (const node of element.childNodes) {
      const text = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').trim() : ''
      if (text !== '') texts.push(text)
    }
  }
  return texts
}

/** A text of a dictionary as a pattern that matches it with anything in the placeholders. */
function pattern(text: string): RegExp {
  const parts = text.split(/\{\w+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`^${parts.join('.+?')}$`, 's')
}

/**
 * The texts on the screen that are Dutch where they should be in `language`: they match a text of
 * the Dutch dictionary whose text in that language is another one. A text that hard-coded Dutch
 * (not in the dictionary) is found by `pnpm lint` and the review, not here. Texts the player typed
 * are not found, because they are not in the dictionary.
 */
export function dutchLeaks(language: LanguageId, root: ParentNode = document.body): string[] {
  const nl = DICTIONARIES.nl
  const other = DICTIONARIES[language]
  const dutch = (Object.keys(nl) as MessageKey[]).flatMap((key) => {
    const theirs = new Set(forms(other[key]))
    return forms(nl[key])
      .filter((text) => !theirs.has(text))
      .map((text) => pattern(text))
  })
  return visibleTexts(root).filter((text) => dutch.some((regex) => regex.test(text)))
}
