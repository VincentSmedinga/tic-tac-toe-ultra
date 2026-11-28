/// <reference lib="webworker" />
import type { Bot, Cell, GameState, PlayerId } from '../../shared/game/index.ts'
import { thinkHere } from './think.ts'

/** What the page asks of the worker, and what the worker answers: one move of the computer. */
export interface BotRequest {
  id: number
  state: GameState
  player: PlayerId
  bot: Bot
  seed: number
}

export interface BotReply {
  id: number
  cell: Cell | null
}

// A move on a big field takes a moment: here it holds nothing else up.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<BotRequest>) => void) | null
  postMessage: (reply: BotReply) => void
}

scope.onmessage = ({ data }) => {
  scope.postMessage({ id: data.id, cell: thinkHere(data.state, data.player, data.bot, data.seed) })
}
