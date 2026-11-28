import type { Bot, BotCharacter, BotLevel, GameConfig, PlayerId } from '../../shared/game/index.ts'
import { cellCount } from '../../shared/game/index.ts'
import type { FieldSettings } from '../../shared/room.ts'
import type { PlainKey, Text } from '../i18n/types.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import type { Thinker } from './think.ts'

/** The computer in a game on this screen: its shape, how it plays, and where it thinks. */
export interface Opponent {
  readonly shape: ShapeId
  readonly bot: Bot
  /** The line under the field that says who you play: "Computer: Moeilijk, Aanvaller". */
  readonly label: string
  readonly think: Thinker
  /** How long the computer waits at least before its move is on the board, in milliseconds. */
  readonly pause: (config: GameConfig) => number
}

export const LEVEL_NAMES: Readonly<Record<BotLevel, PlainKey>> = {
  easy: 'computer.level.easy',
  medium: 'computer.level.medium',
  hard: 'computer.level.hard',
}

export const CHARACTER_NAMES: Readonly<Record<BotCharacter, PlainKey>> = {
  balanced: 'computer.character.balanced',
  defender: 'computer.character.defender',
  attacker: 'computer.character.attacker',
  wild: 'computer.character.wild',
}

/**
 * Whether the characters can be told apart on this field. On nine cells they can't: a game is over
 * before anybody's taste shows, so there is no choice there (docs/plan.md, Against the computer).
 */
export function hasCharacters(field: FieldSettings): boolean {
  return cellCount(field) > 9
}

/** "Computer: Moeilijk, Aanvaller", or without the character where there is none to choose. */
export function opponentLabel(t: Text, bot: Bot, field: FieldSettings): string {
  const level = t(LEVEL_NAMES[bot.level])
  return hasCharacters(field)
    ? t('computer.opponent', { level, character: t(CHARACTER_NAMES[bot.character]) })
    : t('computer.opponentLevel', { level })
}

/** The shape the computer takes for whoever doesn't care: the first one you don't have. */
export function otherShape(all: readonly ShapeId[], taken: PlayerId, wanted: ShapeId): ShapeId {
  if (wanted !== taken) return wanted
  const free = all.find((shape) => shape !== taken)
  if (free === undefined) throw new RangeError('there is no other shape')
  return free
}

/**
 * The pause before a move of the computer: long enough to see your own shape being written and to
 * see the answer come, shorter on a small field, and never twice quite the same.
 */
export function thinkingPause(config: GameConfig, chance: number = Math.random()): number {
  const base = cellCount(config) <= 9 ? 600 : 900
  return base + Math.round(chance * 400)
}
