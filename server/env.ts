import type { Room } from './room.ts'

/** The bindings of the Worker, as set in wrangler.jsonc. */
export interface Env {
  ROOM: DurableObjectNamespace<Room>
}
