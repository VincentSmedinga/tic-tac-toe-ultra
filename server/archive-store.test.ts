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
})
