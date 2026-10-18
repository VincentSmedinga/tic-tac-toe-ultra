import type { nl } from './nl.ts'

/**
 * A text of the game in one language: a whole sentence with `{placeholders}` for what changes, or,
 * when the words change with a number, one whole sentence per plural category of the language
 * (`one`, `other`, and for some languages `few`, `many` …). `count` is the number that picks one.
 */
export type Message = string | Partial<Record<Intl.LDMLPluralRule, string>>

/** Every text there is. Dutch is written first and holds the keys; the others must have the same. */
export type MessageKey = keyof typeof nl

/** All the texts of one language. Missing or extra keys are a type error, and a test. */
export type Dictionary = Readonly<Record<MessageKey, Message>>

type Source = typeof nl

/** The names of the `{placeholders}` in a text. */
type Names<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | Names<Rest>
  : never

type Forms<K extends MessageKey> = Source[K] extends string
  ? Source[K]
  : Source[K][keyof Source[K] & string]

type PluralName<K extends MessageKey> = Source[K] extends string ? never : 'count'

/** What a text needs to be filled in: a value for every placeholder, and `count` for a plural. */
export type Values<K extends MessageKey> = Readonly<
  Record<Names<Forms<K> & string> | PluralName<K>, string | number>
>

/** The arguments of `t(key, …)`: none for a text without placeholders, otherwise the values. */
export type Args<K extends MessageKey> = [Names<Forms<K> & string> | PluralName<K>] extends [never]
  ? []
  : [values: Values<K>]

/** The keys whose text has nothing to fill in: those can be kept and shown later. */
export type PlainKey = { [K in MessageKey]: Args<K> extends [] ? K : never }[MessageKey]

/** The function that turns a key into a text in the language of the page. */
export type Text = <K extends MessageKey>(key: K, ...args: Args<K>) => string
