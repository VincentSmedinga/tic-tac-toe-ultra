import type { StateMessage } from '../../shared/protocol.ts'

/** A room whose game has started: everybody has a shape, and the state holds the game's config. */
export type StartedState = StateMessage & { config: NonNullable<StateMessage['config']> }

export function isStarted(state: StateMessage): state is StartedState {
  return state.config !== undefined
}
