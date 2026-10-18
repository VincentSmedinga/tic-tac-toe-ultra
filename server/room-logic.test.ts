import { describe, expect, it } from 'vitest'
import { roomConfig } from '../shared/room.ts'
import { gameOf, join, newRoom, play, rematch, stateFor } from './room-logic.ts'
import type { Change, RoomState } from './room-logic.ts'

const TOKEN_X = 'x'.repeat(20)
const TOKEN_O = 'o'.repeat(20)
const TOKEN_Z = 'z'.repeat(20)

/** The room after a change that must have worked. */
function room(change: Change): RoomState {
  if (!change.ok) throw new Error(`refused: ${change.error}`)
  return change.room
}

function twoPlayers(): RoomState {
  return room(join(room(join(newRoom(), TOKEN_X, undefined)), TOKEN_O, undefined))
}

/** Plays the cells, taking turns from the player who starts. */
function playCells(start: RoomState, cells: readonly (readonly [number, number])[]): RoomState {
  return cells.reduce((current, [x, y]) => {
    const game = gameOf(current)
    if (game.kind !== 'game') throw new Error('no game to play')
    const { status } = game.game
    if (status.kind !== 'playing') throw new Error('the game is over')
    const seat = current.seats.find((candidate) => candidate.id === status.next)
    return room(play(current, seat?.token ?? '', { x, y }))
  }, start)
}

// X wins on the top row; O has two marks on the middle row.
const xWins = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 0],
] as const

// A drawn game.
const draw = [
  [0, 0],
  [1, 0],
  [2, 0],
  [1, 1],
  [0, 1],
  [2, 1],
  [1, 2],
  [0, 2],
  [2, 2],
] as const

describe('joining', () => {
  it('gives the first player the first seat and the second player the second', () => {
    const joined = twoPlayers()
    expect(joined.seats.map(({ id, token }) => [id, token])).toEqual([
      ['X', TOKEN_X],
      ['O', TOKEN_O],
    ])
  })

  it('refuses a third player, and changes nothing', () => {
    const before = twoPlayers()
    expect(join(before, TOKEN_Z, undefined)).toEqual({ ok: false, error: 'room-full' })
    expect(before.seats).toHaveLength(2)
  })

  it('gives a player who comes back the same seat, and no extra one', () => {
    const back = room(join(twoPlayers(), TOKEN_X, undefined))
    expect(back.seats).toHaveLength(2)
    expect(back.seats[0]).toMatchObject({ id: 'X', token: TOKEN_X })
  })

  it('keeps a name, and changes it when a new one comes with the join', () => {
    let current = room(join(newRoom(), TOKEN_X, 'Anna'))
    expect(current.seats[0]?.name).toBe('Anna')
    current = room(join(current, TOKEN_X, undefined))
    expect(current.seats[0]?.name).toBe('Anna')
    current = room(join(current, TOKEN_X, 'Bo'))
    expect(current.seats[0]?.name).toBe('Bo')
  })
})

describe('the game of a room', () => {
  it('waits until there are two players', () => {
    expect(gameOf(newRoom()).kind).toBe('waiting')
    expect(gameOf(room(join(newRoom(), TOKEN_X, undefined))).kind).toBe('waiting')
    expect(gameOf(twoPlayers()).kind).toBe('game')
  })

  it('is damaged when the moves in storage are not a game', () => {
    const broken: RoomState = {
      ...twoPlayers(),
      moves: [
        { player: 'X', x: 0, y: 0 },
        { player: 'X', x: 1, y: 0 },
      ],
    }
    expect(gameOf(broken).kind).toBe('damaged')
  })
})

describe('playing', () => {
  it('takes a valid move and keeps it', () => {
    const played = room(play(twoPlayers(), TOKEN_X, { x: 1, y: 1 }))
    expect(played.moves).toEqual([{ player: 'X', x: 1, y: 1 }])
  })

  it('refuses a move from someone who has no seat', () => {
    expect(play(twoPlayers(), TOKEN_Z, { x: 0, y: 0 })).toEqual({ ok: false, error: 'not-joined' })
  })

  it('refuses a move while the second player is not there yet', () => {
    const alone = room(join(newRoom(), TOKEN_X, undefined))
    expect(play(alone, TOKEN_X, { x: 0, y: 0 })).toEqual({
      ok: false,
      error: 'waiting-for-opponent',
    })
  })

  it.each([
    ['out of turn', TOKEN_O, { x: 0, y: 0 }, 'not-your-turn'],
    ['outside the field', TOKEN_X, { x: 3, y: 0 }, 'out-of-bounds'],
  ] as const)('refuses a move %s', (_name, token, cell, error) => {
    expect(play(twoPlayers(), token, cell)).toEqual({ ok: false, error })
  })

  it('refuses a move on a cell that is taken', () => {
    const played = room(play(twoPlayers(), TOKEN_X, { x: 1, y: 1 }))
    expect(play(played, TOKEN_O, { x: 1, y: 1 })).toEqual({ ok: false, error: 'cell-taken' })
  })

  it('plays a whole game to a win, and then takes no more moves', () => {
    const won = playCells(twoPlayers(), xWins)
    const game = gameOf(won)
    expect(game.kind === 'game' && game.game.status).toMatchObject({ kind: 'won', winner: 'X' })
    expect(play(won, TOKEN_O, { x: 2, y: 2 })).toEqual({ ok: false, error: 'game-over' })
  })

  it('plays a whole game to a draw', () => {
    const drawn = playCells(twoPlayers(), draw)
    const game = gameOf(drawn)
    expect(game.kind === 'game' && game.game.status).toEqual({ kind: 'draw' })
  })

  it('refuses moves in a damaged room', () => {
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'O', x: 0, y: 0 }] }
    expect(play(broken, TOKEN_X, { x: 1, y: 1 })).toEqual({ ok: false, error: 'room-damaged' })
  })
})

describe('a rematch', () => {
  it('is refused while the game is on, by someone without a seat, or while waiting', () => {
    expect(rematch(twoPlayers(), TOKEN_X)).toEqual({ ok: false, error: 'game-not-over' })
    expect(rematch(playCells(twoPlayers(), xWins), TOKEN_Z)).toEqual({
      ok: false,
      error: 'not-joined',
    })
    expect(rematch(room(join(newRoom(), TOKEN_X, undefined)), TOKEN_X)).toEqual({
      ok: false,
      error: 'waiting-for-opponent',
    })
  })

  it('starts a new round with an empty field in which the other player starts', () => {
    const next = room(rematch(playCells(twoPlayers(), xWins), TOKEN_X))
    expect(next.round).toBe(1)
    expect(next.moves).toEqual([])
    expect(roomConfig(next.round).players).toEqual(['O', 'X'])
    expect(play(next, TOKEN_X, { x: 0, y: 0 })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(play(next, TOKEN_O, { x: 0, y: 0 }).ok).toBe(true)
  })

  it('goes back to the first player after two rounds', () => {
    const second = room(rematch(playCells(twoPlayers(), xWins), TOKEN_O))
    const third = room(
      rematch(
        playCells(
          second,
          xWins.map(([x, y]) => [x, y] as const),
        ),
        TOKEN_X,
      ),
    )
    expect(roomConfig(third.round).players).toEqual(['X', 'O'])
  })

  it('gets a damaged room going again', () => {
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'O', x: 0, y: 0 }] }
    const fixed = room(rematch(broken, TOKEN_X))
    expect(gameOf(fixed).kind).toBe('game')
    expect(fixed.moves).toEqual([])
  })
})

describe('the state for a player', () => {
  it('is null for someone without a seat', () => {
    expect(stateFor(twoPlayers(), TOKEN_Z, 'BCDF', new Set())).toBeNull()
  })

  it('says who you are, who has a seat and who is connected', () => {
    const state = stateFor(twoPlayers(), TOKEN_O, 'BCDF', new Set([TOKEN_O]))
    expect(state).toMatchObject({
      type: 'state',
      code: 'BCDF',
      you: 'O',
      round: 0,
      players: [
        { id: 'X', connected: false },
        { id: 'O', connected: true },
      ],
      config: { width: 3, height: 3, winLength: 3, players: ['X', 'O'] },
      moves: [],
    })
  })

  it('has the names, only for the players who gave one', () => {
    const named = room(join(room(join(newRoom(), TOKEN_X, 'Anna')), TOKEN_O, undefined))
    const players = stateFor(named, TOKEN_X, 'BCDF', new Set())?.players
    expect(players?.[0]).toEqual({ id: 'X', name: 'Anna', connected: false })
    expect(players?.[1]).toEqual({ id: 'O', connected: false })
  })

  it("never holds anybody's token", () => {
    const text = JSON.stringify(
      stateFor(twoPlayers(), TOKEN_X, 'BCDF', new Set([TOKEN_X, TOKEN_O])),
    )
    expect(text).not.toContain(TOKEN_X)
    expect(text).not.toContain(TOKEN_O)
  })

  it('shows the moves, and an empty field when the room is damaged', () => {
    const played = room(play(twoPlayers(), TOKEN_X, { x: 2, y: 2 }))
    expect(stateFor(played, TOKEN_O, 'BCDF', new Set())?.moves).toEqual([
      { player: 'X', x: 2, y: 2 },
    ])
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'O', x: 0, y: 0 }] }
    expect(stateFor(broken, TOKEN_O, 'BCDF', new Set())?.moves).toEqual([])
  })
})
