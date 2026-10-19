import type { Archive } from './archive.ts'
import type { Room } from './room.ts'

/** The bindings of the Worker, as set in wrangler.jsonc. */
export interface Env {
  ROOM: DurableObjectNamespace<Room>
  ARCHIVE: DurableObjectNamespace<Archive>
  /** The files of the build (`pnpm build`): the app and its pictures. */
  ASSETS: Fetcher
}
