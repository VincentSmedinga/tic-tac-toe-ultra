import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { fill, pick } from './text.ts'
import { DICTIONARIES } from './dictionaries.ts'
import { localeOf } from './language.ts'
import { useLanguage } from './store.ts'
import type { MessageKey } from './types.ts'

/**
 * A text with an element in it ("Je zit in kamer <strong>BCDF</strong>"): the text is still one
 * whole text per language, and the element takes the place of its placeholder.
 */
export function Rich({
  text,
  values,
}: {
  text: MessageKey
  values: Readonly<Record<string, ReactNode>>
}) {
  const language = useLanguage()
  const parts = fill(pick(DICTIONARIES[language][text], localeOf(language)), values)
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  )
}
