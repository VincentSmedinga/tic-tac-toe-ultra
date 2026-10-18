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

  it('keeps when the game started, so that its duration is known', () => {
    store.save({ ...WON, id: 'started-started-', startedAt: 1_699_999_990_000 }, 1_700_000_000_000)
    const game = store.get('started-started-')
    expect(game?.startedAt).toBe(1_699_999_990_000)
    expect((game?.finishedAt ?? 0) - (game?.startedAt ?? 0)).toBe(10_000)
  })

  it('keeps a game without a start, as it was kept before, and does not make one up', () => {
    store.save(WON, 1)
    expect(store.get(WON.id)).not.toHaveProperty('startedAt')
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

  it('does not read a game whose JSON is broken, instead of failing', () => {
    store.save(WON, 1)
    database.prepare('UPDATE games SET data = \'{"id":\'').run()
    expect(store.get(WON.id)).toBeNull()
  })

  it('skips a broken game in a list and still lists the others', () => {
    store.save({ ...WON, id: 'broken-broken-br', owners: ['hash-x'] }, 1)
    store.save({ ...WON, id: 'fine-fine-fine-f', owners: ['hash-x'] }, 2)
    database.prepare("UPDATE games SET data = 'not json' WHERE id = 'broken-broken-br'").run()
    expect(store.list('hash-x', 10).games.map(({ id }) => id)).toEqual(['fine-fine-fine-f'])
  })

  it('can be opened again on the same storage', () => {
    store.save(WON, 1)
    const again = new ArchiveStore(sqlOver(database))
    expect(again.get(WON.id)?.id).toBe(WON.id)
  })

  describe('counting rooms and rounds', () => {
    it('counts the rooms that were made, each once', () => {
      store.roomMade('room-one', 1, 2)
      store.roomMade('room-one', 2, 2)
      store.roomMade('room-two', 3, 4)
      expect(store.roomCounts()).toEqual({ made: 2, rounds: [] })
    })

    it('counts the rounds of each room that has games, and no more than the games say', () => {
      store.roomMade('room-one', 1, 2)
      store.roomMade('room-two', 1, 2)
      store.roomMade('room-three', 1, 2)
      for (const [id, roomId] of [
        ['game-1-game-1-gam', 'room-one'],
        ['game-2-game-2-gam', 'room-one'],
        ['game-3-game-3-gam', 'room-one'],
        ['game-4-game-4-gam', 'room-two'],
      ] as const) {
        store.save({ ...WON, id, roomId }, 10)
      }
      store.save({ ...WON, id: 'no-room-no-room-n' }, 11)
      const { made, rounds } = store.roomCounts()
      expect(made).toBe(3)
      expect([...rounds].sort()).toEqual([1, 3])
    })

    it('keeps the room next to the game and never in it', () => {
      store.save({ ...WON, roomId: 'room-one' }, 1)
      expect(JSON.stringify(store.get(WON.id))).not.toContain('room-one')
      expect(JSON.stringify(store.all())).not.toContain('room-one')
      expect(JSON.stringify(store.list('hash-x', 10))).not.toContain('room-one')
    })

    it('takes over an archive from before rooms were counted, and opens again', () => {
      const old = new DatabaseSync(':memory:')
      old.exec(
        'CREATE TABLE games (id TEXT PRIMARY KEY, finished_at INTEGER NOT NULL, data TEXT NOT NULL)',
      )
      old
        .prepare('INSERT INTO games (id, finished_at, data) VALUES (?, ?, ?)')
        .run(WON.id, 5, JSON.stringify({ ...WON, finishedAt: 5, owners: undefined }))
      const upgraded = new ArchiveStore(sqlOver(old))
      expect(upgraded.get(WON.id)?.finishedAt).toBe(5)
      upgraded.save({ ...WON, id: 'newer-newer-newe', roomId: 'room-one' }, 6)
      expect(new ArchiveStore(sqlOver(old)).roomCounts()).toEqual({ made: 0, rounds: [1] })
    })
  })

  describe('listing every game', () => {
    it('gives all games oldest first, and skips one that was damaged', () => {
      store.save({ ...WON, id: 'second-second-se' }, 20)
      store.save({ ...WON, id: 'first-first-firs' }, 10)
      store.save({ ...WON, id: 'broken-broken-br' }, 30)
      database.prepare("UPDATE games SET data = 'not json' WHERE id = 'broken-broken-br'").run()
      expect(store.all().map(({ id }) => id)).toEqual(['first-first-firs', 'second-second-se'])
    })

    it('is empty before a game is kept', () => {
      expect(store.all()).toEqual([])
    })

    it('holds no token, hash or owner, so the statistics can never give one away', () => {
      store.save({ ...WON, owners: ['hash-x'] }, 1)
      expect(JSON.stringify(store.all())).not.toContain('hash-')
    })
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
