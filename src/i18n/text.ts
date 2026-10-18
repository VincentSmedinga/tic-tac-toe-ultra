import type { Dictionary, Message, MessageKey, Text } from './types.ts'

/** The `{placeholder}` names in a text, in the order they occur. */
export function placeholders(text: string): string[] {
  return Array.from(text.matchAll(/\{(\w+)\}/g), (match) => match[1] ?? '')
}

/** The sentences of a message: its one text, or one per plural category. */
export function forms(message: Message): string[] {
  return typeof message === 'string' ? [message] : Object.values(message)
}

const rules = new Map<string, Intl.PluralRules>()

function pluralCategory(locale: string, count: number): Intl.LDMLPluralRule {
  let found = rules.get(locale)
  if (!found) {
    found = new Intl.PluralRules(locale)
    rules.set(locale, found)
  }
  return found.select(count)
}

/** Which text of a message to use: the only one, or the plural category the count falls in. */
export function pick(message: Message, locale: string, count?: number): string {
  if (typeof message === 'string') return message
  const category = count === undefined ? 'other' : pluralCategory(locale, count)
  const chosen = message[category] ?? message.other
  if (chosen === undefined) throw new RangeError(`no text for ${category}`)
  return chosen
}

/** A number as the language writes it, with at most one decimal (6,3): counts are whole anyway. */
export function formatNumber(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
}

/**
 * Cuts a text at its `{placeholders}` and gives the parts: the pieces of text and, in between,
 * what the placeholders stand for. A placeholder without a value stays as it is, so that a
 * mistake shows on the screen and in a test instead of hiding.
 */
export function fill<V>(text: string, values: Readonly<Record<string, V>>): (string | V)[] {
  return text
    .split(/(\{\w+\})/)
    .filter((part) => part !== '')
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1]
      return name !== undefined && name in values ? (values[name] as V) : part
    })
}

/** The text function for one language: `t('status.won', { name })`. */
export function makeText(dictionary: Dictionary, locale: string): Text {
  return (key: MessageKey, ...args: [values?: Readonly<Record<string, string | number>>]) => {
    const values = args[0] ?? {}
    const count = typeof values.count === 'number' ? values.count : undefined
    const shown = Object.fromEntries(
      Object.entries(values).map(([name, value]) => [
        name,
        typeof value === 'number' ? formatNumber(locale, value) : value,
      ]),
    )
    return fill(pick(dictionary[key], locale, count), shown).join('')
  }
}
