import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { replayGame } from '../shared/game/index.ts'
import { storedGameSchema } from '../shared/protocol.ts'
import { ArchiveStore } from './archive-store.ts'
import type { NewGame, Sql } from './archive-store.ts'

// This file runs on Node, with its built-in SQLite standing in for the Durable Object's.
// (It is the one test in server/ that is checked with Node's types: see tsconfig.node.json.)

function sqlOver(database: DatabaseSync): Sql {
  return {
    exec: (query, ...bindings) => {
      const statement = database.prepare(query)
      const rows = /^\s*SELECT/i.test(query)
        ? statement.all(...bindings)
        : (statement.run(...bindings), [])
      return { toArray: () => rows }
    },
  }
}

const WON: NewGame = {
  id: 'abcdefghijklmnop',
  config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
  moves: [
    { player: 'X', x: 0, y: 0 },
    { player: 'O', x: 0, y: 1 },
    { player: 'X', x: 1, y: 0 },
    { player: 'O', x: 1, y: 1 },
    { player: 'X', x: 2, y: 0 },
  ],
  players: [{ id: 'X', name: 'Anna' }, { id: 'O' }],
  result: { kind: 'won', winner: 'X' },
  owners: ['hash-x', 'hash-o'],
}

describe('the archive store', () => {
  let store: ArchiveStore
  let database: DatabaseSync
  beforeEach(() => {
    database = new DatabaseSync(':memory:')
    store = new ArchiveStore(sqlOver(database))
  })

  it('reads a saved game back, the same and with the time it ended', () => {
    store.save(WON, 1_700_000_000_000)
    expect(store.get(WON.id)).toEqual({
      id: WON.id,
      finishedAt: 1_700_000_000_000,
      config: WON.config,
      moves: WON.moves,
      players: WON.players,
      result: WON.result,
    })
  })

  it('reads back a game the engine can replay without errors', () => {
    store.save(WON, 1)
    const game = store.get(WON.id)
    if (!game) throw new Error('the game was not kept')
    expect(storedGameSchema.safeParse(game).success).toBe(true)
    const replayed = replayGame(game.config, game.moves)
    expect(replayed.ok && replayed.state.status).toMatchObject({ kind: 'won', winner: 'X' })
  })

  it('knows no game it was not given, and keeps nothing under another id', () => {
    store.save(WON, 1)
    expect(store.get('zzzzzzzzzzzzzzzz')).toBeNull()
  })

  it('keeps a game once, however often it is saved', () => {
    store.save(WON, 1)
    store.save(WON, 2)
    expect(store.get(WON.id)?.finishedAt).toBe(1)
    const rows = database.prepare('SELECT COUNT(*) AS n FROM games').get()
    expect(rows).toEqual({ n: 1 })
  })

  it('keeps a drawn game', () => {
    const draw: NewGame = { ...WON, id: 'drawdrawdrawdraw', result: { kind: 'draw' } }
    store.save(draw, 5)
    expect(store.get(draw.id)?.result).toEqual({ kind: 'draw' })
  })

  it('writes down who sat at the game, once each, and never in the game itself', () => {
    store.save({ ...WON, owners: ['hash-x', 'hash-o', 'hash-x'] }, 7)
    const owners = database.prepare('SELECT owner FROM players ORDER BY owner').all()
    expect(owners).toEqual([{ owner: 'hash-o' }, { owner: 'hash-x' }])
    const data = database.prepare('SELECT data FROM games').get()
    expect(JSON.stringify(data)).not.toContain('hash-')
  })

  it('does not read a game that was damaged in storage', () => {
    store.save(WON, 1)
    database.prepare('UPDATE games SET data = \'{"id":1}\'').run()
    expect(store.get(WON.id)).toBeNull()
  })

  it('can be opened again on the same storage', () => {
    store.save(WON, 1)
    const again = new ArchiveStore(sqlOver(database))
    expect(again.get(WON.id)?.id).toBe(WON.id)
  })

  describe('listing the games of a player', () => {
    /** A game with an id made from a number, played by these owners at this time. */
    const idOf = (n: number) => n.toString().padStart(16, 'g')
    function save(n: number, owners: string[], finishedAt = n * 1000) {
      store.save({ ...WON, id: idOf(n), owners }, finishedAt)
    }

    it('gives the games the player sat at, newest first, as summaries', () => {
      save(1, ['hash-x'])
      save(2, ['hash-x', 'hash-o'])
      save(3, ['hash-o'])
      const page = store.list('hash-x', 10)
      expect(page.games.map(({ id }) => id)).toEqual([idOf(2), idOf(1)])
      expect(page.games[0]).toEqual({
        id: idOf(2),
        finishedAt: 2000,
        players: WON.players,
        result: WON.result,
        width: 3,
        height: 3,
        moves: 5,
      })
      expect(page.next).toBeUndefined()
    })

    it('is empty for someone who played nothing', () => {
      save(1, ['hash-x'])
      expect(store.list('hash-nobody', 10)).toEqual({ games: [] })
    })

    it('goes through the games a page at a time, until there are no more', () => {
      for (let n = 1; n <= 5; n++) save(n, ['hash-x'])
      const first = store.list('hash-x', 2)
      expect(first.games.map(({ finishedAt }) => finishedAt)).toEqual([5000, 4000])
      expect(first.next).toBeDefined()
      const second = store.list('hash-x', 2, first.next)
      expect(second.games.map(({ finishedAt }) => finishedAt)).toEqual([3000, 2000])
      const third = store.list('hash-x', 2, second.next)
      expect(third.games.map(({ finishedAt }) => finishedAt)).toEqual([1000])
      expect(third.next).toBeUndefined()
    })

    it('has no next page when the last page is exactly full', () => {
      save(1, ['hash-x'])
      save(2, ['hash-x'])
      expect(store.list('hash-x', 2).next).toBeUndefined()
    })

    it('keeps its place when new games are played between two pages', () => {
      for (let n = 1; n <= 3; n++) save(n, ['hash-x'])
      const first = store.list('hash-x', 2)
      save(4, ['hash-x'])
      const second = store.list('hash-x', 2, first.next)
      expect(second.games.map(({ finishedAt }) => finishedAt)).toEqual([1000])
    })

    it('does not skip or repeat games that ended at the same moment', () => {
      for (let n = 1; n <= 5; n++) save(n, ['hash-x'], 7000)
      const seen: string[] = []
      let next: string | undefined
      do {
        const page = store.list('hash-x', 2, next)
        seen.push(...page.games.map(({ id }) => id))
        next = page.next
      } while (next !== undefined)
      expect(seen).toHaveLength(5)
      expect(new Set(seen).size).toBe(5)
    })

    it('starts at the top when the cursor is no cursor', () => {
      save(1, ['hash-x'])
      expect(store.list('hash-x', 10, 'nonsense').games).toHaveLength(1)
    })
  })
})
