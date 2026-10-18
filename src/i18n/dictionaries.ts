import { en } from './en.ts'
import { fy } from './fy.ts'
import type { LanguageId } from './language.ts'
import { nl } from './nl.ts'
import type { Dictionary } from './types.ts'

/** The texts of every language, by its id. */
export const DICTIONARIES: Readonly<Record<LanguageId, Dictionary>> = { nl, en, fy }
