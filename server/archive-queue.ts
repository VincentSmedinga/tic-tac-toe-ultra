import type { Finished } from './room-logic.ts'

/** A finished game that is waiting to be kept, with the moment it ended and the tries so far. */
export interface Pending {
  id: string
  finishedAt: number
  game: Finished
  attempts: number
}

/** After this many failed tries a game is given up on, so one that can never be kept doesn't loop. */
export const MAX_ATTEMPTS = 20

/** What the queue needs from the room that owns it. */
export interface QueueHost {
  /** The games waiting, as kept in the room's storage. */
  read(): Pending[]
  write(pending: Pending[]): void
  /** Keeps one game in the archive; rejects when that fails. Keeping the same id twice is harmless. */
  save(entry: Pending): Promise<void>
  /** The game is in the archive now. */
  saved(id: string): void
}

/**
 * The games a room has handed over but the archive hasn't confirmed yet. They sit in the room's
 * storage until the archive says it has them, so a failed call, a sleeping room or a rematch doesn't
 * lose a game: it is tried again (see `Room.alarm`) with the same id, which is what the players
 * were told. Without Cloudflare around it, so it is tested with a fake host.
 */
export class ArchiveQueue {
  private readonly host: QueueHost
  private running: Promise<void> | undefined

  constructor(host: QueueHost) {
    this.host = host
  }

  add(id: string, game: Finished, finishedAt: number): void {
    this.host.write([...this.host.read(), { id, finishedAt, game, attempts: 0 }])
  }

  /** How many games are still waiting. */
  size(): number {
    return this.host.read().length
  }

  /** Tries once to keep every waiting game; one run at a time, a second call joins the one that runs. */
  flush(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = undefined
    })
    return this.running
  }

  private async run(): Promise<void> {
    // Games added while this runs are picked up too; one that failed waits for the next run.
    const tried = new Set<string>()
    for (;;) {
      const entry = this.host.read().find((candidate) => !tried.has(candidate.id))
      if (!entry) return
      tried.add(entry.id)
      try {
        await this.host.save(entry)
      } catch (error) {
        this.failed(entry.id, error)
        continue
      }
      this.remove(entry.id)
      this.host.saved(entry.id)
    }
  }

  private remove(id: string): void {
    this.host.write(this.host.read().filter((entry) => entry.id !== id))
  }

  private failed(id: string, error: unknown): void {
    const pending = this.host.read()
    const entry = pending.find((candidate) => candidate.id === id)
    if (!entry) return
    if (entry.attempts + 1 >= MAX_ATTEMPTS) {
      console.error(`Giving up on keeping game ${id}`, error)
      this.remove(id)
      return
    }
    this.host.write(
      pending.map((candidate) =>
        candidate.id === id ? { ...candidate, attempts: candidate.attempts + 1 } : candidate,
      ),
    )
  }
}
