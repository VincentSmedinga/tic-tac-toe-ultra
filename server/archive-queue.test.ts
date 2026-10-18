import { describe, expect, it, vi } from 'vitest'
import { ArchiveQueue, MAX_ATTEMPTS } from './archive-queue.ts'
import type { Pending } from './archive-queue.ts'
import type { Finished } from './room-logic.ts'

const GAME: Finished = {
  config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
  moves: [],
  players: [{ id: 'X' }, { id: 'O' }],
  result: { kind: 'draw' },
  owners: ['token-x', 'token-o'],
}

/** A queue on storage that is a variable, and an archive that can be told to fail. */
function setup() {
  const stored: { pending: Pending[] } = { pending: [] }
  const saves: Pending[] = []
  const told: string[] = []
  const archive = { fail: false, gate: undefined as Promise<void> | undefined }
  const queue = new ArchiveQueue({
    read: () => stored.pending,
    write: (pending) => {
      stored.pending = pending
    },
    save: async (entry) => {
      await archive.gate
      if (archive.fail) throw new Error('archive is down')
      saves.push(entry)
    },
    saved: (id) => {
      told.push(id)
    },
  })
  return { queue, stored, saves, told, archive }
}

describe('ArchiveQueue', () => {
  it('keeps a game waiting until it is flushed, with the time it ended', () => {
    const { queue, stored } = setup()
    queue.add('game-1', GAME, 1234)
    expect(queue.size()).toBe(1)
    expect(stored.pending).toEqual([{ id: 'game-1', finishedAt: 1234, game: GAME, attempts: 0 }])
  })

  it('saves the games in order, takes them off the queue and says they are saved', async () => {
    const { queue, saves, told } = setup()
    queue.add('game-1', GAME, 1)
    queue.add('game-2', GAME, 2)
    await queue.flush()
    expect(saves.map(({ id, finishedAt }) => [id, finishedAt])).toEqual([
      ['game-1', 1],
      ['game-2', 2],
    ])
    expect(told).toEqual(['game-1', 'game-2'])
    expect(queue.size()).toBe(0)
  })

  it('keeps a game that could not be saved, and saves it with the same id the next time', async () => {
    const { queue, archive, saves, told } = setup()
    queue.add('game-1', GAME, 1)
    archive.fail = true
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await queue.flush()
    expect(queue.size()).toBe(1)
    expect(told).toEqual([])

    archive.fail = false
    await queue.flush()
    expect(queue.size()).toBe(0)
    expect(saves.map(({ id }) => id)).toEqual(['game-1'])
    expect(told).toEqual(['game-1'])
  })

  it('goes on with the next game when one fails', async () => {
    const { queue, stored, told } = setup()
    queue.add('game-1', GAME, 1)
    queue.add('game-2', GAME, 2)
    // Only the first one fails.
    const save = vi.fn((entry: Pending) =>
      entry.id === 'game-1' ? Promise.reject(new Error('no')) : Promise.resolve(),
    )
    const own = new ArchiveQueue({
      read: () => stored.pending,
      write: (pending) => {
        stored.pending = pending
      },
      save,
      saved: (id) => {
        told.push(id)
      },
    })
    await own.flush()
    expect(told).toEqual(['game-2'])
    expect(stored.pending.map(({ id, attempts }) => [id, attempts])).toEqual([['game-1', 1]])
  })

  it('gives up on a game after too many tries', async () => {
    const { queue, archive } = setup()
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    queue.add('game-1', GAME, 1)
    archive.fail = true
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      await queue.flush()
      expect(queue.size()).toBe(1)
    }
    await queue.flush()
    expect(queue.size()).toBe(0)
    expect(log).toHaveBeenCalledOnce()
  })

  it('does not save a game twice when it is flushed twice at the same time', async () => {
    const { queue, archive, saves } = setup()
    let open: () => void = () => undefined
    archive.gate = new Promise((resolve) => {
      open = resolve
    })
    queue.add('game-1', GAME, 1)
    const first = queue.flush()
    const second = queue.flush()
    open()
    await Promise.all([first, second])
    expect(saves).toHaveLength(1)
  })

  it('also saves a game that is added while another is being saved', async () => {
    const { queue, archive, saves, told } = setup()
    let open: () => void = () => undefined
    archive.gate = new Promise((resolve) => {
      open = resolve
    })
    queue.add('game-1', GAME, 1)
    const flushing = queue.flush()
    queue.add('game-2', GAME, 2)
    open()
    await flushing
    expect(saves.map(({ id }) => id)).toEqual(['game-1', 'game-2'])
    expect(told).toEqual(['game-1', 'game-2'])
    expect(queue.size()).toBe(0)
  })

  it('can be flushed again after a run, and with nothing to do', async () => {
    const { queue } = setup()
    await queue.flush()
    queue.add('game-1', GAME, 1)
    await queue.flush()
    await queue.flush()
    expect(queue.size()).toBe(0)
  })
})
