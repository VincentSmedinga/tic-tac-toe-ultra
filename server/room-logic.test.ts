import { describe, expect, it } from 'vitest'
import { roomConfig } from '../shared/room.ts'
import {
  choose,
  finishedGame,
  gameOf,
  isOver,
  join,
  newRoom,
  play,
  rematch,
  stateFor,
  undo,
  upgradeRoom,
  fieldOf,
  seatCountOf,
  startGame,
} from './room-logic.ts'
import type { Change, RoomState } from './room-logic.ts'

const TOKEN_X = 'x'.repeat(20)
const TOKEN_O = 'o'.repeat(20)
const TOKEN_Z = 'z'.repeat(20)

/** The room after a change that must have worked. */
function room(change: Change): RoomState {
  if (!change.ok) throw new Error(`refused: ${change.error}`)
  return change.room
}

/** Two players who have chosen: the first seat has the cross, the second the circle. */
function twoPlayers(): RoomState {
  return room(
    join(room(join(newRoom(), TOKEN_X, undefined, 'cross')), TOKEN_O, undefined, 'circle'),
  )
}

/** Two players who are both here and have chosen nothing yet. */
function undecided(): RoomState {
  return room(join(room(join(newRoom(), TOKEN_X, undefined)), TOKEN_O, undefined))
}

/** Plays the cells, taking turns from the player who starts. */
function playCells(start: RoomState, cells: readonly (readonly [number, number])[]): RoomState {
  return cells.reduce((current, [x, y]) => {
    const game = gameOf(current)
    if (game.kind !== 'game') throw new Error('no game to play')
    const { status } = game.game
    if (status.kind !== 'playing') throw new Error('the game is over')
    const seat = current.seats.find((candidate) => candidate.shape === status.next)
    return room(play(current, seat?.token ?? '', { x, y }))
  }, start)
}

// The cross wins on the top row; the circle has two marks on the middle row.
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
    expect(gameOf(room(join(newRoom(), TOKEN_X, undefined, 'cross'))).kind).toBe('waiting')
    expect(gameOf(twoPlayers()).kind).toBe('game')
  })

  it('is damaged when the moves in storage are not a game', () => {
    const broken: RoomState = {
      ...twoPlayers(),
      moves: [
        { player: 'cross', x: 0, y: 0 },
        { player: 'cross', x: 1, y: 0 },
      ],
    }
    expect(gameOf(broken).kind).toBe('damaged')
  })
})

describe('playing', () => {
  it('takes a valid move and keeps it', () => {
    const played = room(play(twoPlayers(), TOKEN_X, { x: 1, y: 1 }))
    expect(played.moves).toEqual([{ player: 'cross', x: 1, y: 1 }])
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
    expect(game.kind === 'game' && game.game.status).toMatchObject({ kind: 'won', winner: 'cross' })
    expect(play(won, TOKEN_O, { x: 2, y: 2 })).toEqual({ ok: false, error: 'game-over' })
  })

  it('plays a whole game to a draw', () => {
    const drawn = playCells(twoPlayers(), draw)
    const game = gameOf(drawn)
    expect(game.kind === 'game' && game.game.status).toEqual({ kind: 'draw' })
  })

  it('refuses moves in a damaged room', () => {
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'circle', x: 0, y: 0 }] }
    expect(play(broken, TOKEN_X, { x: 1, y: 1 })).toEqual({ ok: false, error: 'room-damaged' })
  })
})

describe('taking a move back', () => {
  it('takes back the last move of the one who played it, who then moves again', () => {
    const played = playCells(twoPlayers(), [[0, 0]])
    const back = room(undo(played, TOKEN_X))
    expect(back.moves).toEqual([])
    expect(play(back, TOKEN_O, { x: 0, y: 0 })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(room(play(back, TOKEN_X, { x: 1, y: 1 })).moves).toEqual([
      { player: 'cross', x: 1, y: 1 },
    ])
  })

  it('takes back one move at a time, in the order they were played', () => {
    const played = playCells(twoPlayers(), [
      [0, 0],
      [1, 1],
    ])
    const back = room(undo(played, TOKEN_O))
    expect(back.moves).toEqual([{ player: 'cross', x: 0, y: 0 }])
    expect(room(undo(back, TOKEN_X)).moves).toEqual([])
  })

  it('is refused when the last move is not yours, once the next player has moved', () => {
    const played = playCells(twoPlayers(), [[0, 0]])
    expect(undo(played, TOKEN_O)).toEqual({ ok: false, error: 'cannot-undo' })
    const later = playCells(played, [[1, 1]])
    expect(undo(later, TOKEN_X)).toEqual({ ok: false, error: 'cannot-undo' })
  })

  it('is refused without a move, for a stranger, while waiting or choosing, and once the game is over', () => {
    expect(undo(twoPlayers(), TOKEN_X)).toEqual({ ok: false, error: 'cannot-undo' })
    expect(undo(playCells(twoPlayers(), [[0, 0]]), TOKEN_Z)).toEqual({
      ok: false,
      error: 'not-joined',
    })
    expect(undo(room(join(newRoom(), TOKEN_X, undefined)), TOKEN_X)).toEqual({
      ok: false,
      error: 'waiting-for-opponent',
    })
    expect(undo(undecided(), TOKEN_X)).toEqual({ ok: false, error: 'shape-needed' })
    expect(undo(playCells(twoPlayers(), xWins), TOKEN_X)).toEqual({
      ok: false,
      error: 'game-over',
    })
  })

  it('is refused in a damaged room', () => {
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'circle', x: 0, y: 0 }] }
    expect(undo(broken, TOKEN_O)).toEqual({ ok: false, error: 'room-damaged' })
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
    expect(roomConfig(next.round, ['cross', 'circle']).players).toEqual(['circle', 'cross'])
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
    expect(roomConfig(third.round, ['cross', 'circle']).players).toEqual(['cross', 'circle'])
  })

  it('gets a damaged room going again', () => {
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'circle', x: 0, y: 0 }] }
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
        { id: 'X', shape: 'cross', connected: false },
        { id: 'O', shape: 'circle', connected: true },
      ],
      config: { width: 3, height: 3, winLength: 3, players: ['cross', 'circle'] },
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
      { player: 'cross', x: 2, y: 2 },
    ])
    const broken: RoomState = { ...twoPlayers(), moves: [{ player: 'circle', x: 0, y: 0 }] }
    expect(stateFor(broken, TOKEN_O, 'BCDF', new Set())?.moves).toEqual([])
  })
})

describe('a finished game', () => {
  it('is only there once the round is won or drawn', () => {
    expect(isOver(newRoom())).toBe(false)
    expect(finishedGame(twoPlayers())).toBeNull()
    expect(finishedGame(playCells(twoPlayers(), xWins.slice(0, 4)))).toBeNull()
    expect(isOver(playCells(twoPlayers(), xWins))).toBe(true)
  })

  it('holds the config, the moves, the players and who won', () => {
    const finished = finishedGame(playCells(twoPlayers(), xWins))
    expect(finished).toMatchObject({
      config: roomConfig(0, ['cross', 'circle']),
      players: [{ id: 'cross' }, { id: 'circle' }],
      result: { kind: 'won', winner: 'cross' },
      owners: [TOKEN_X, TOKEN_O],
    })
    expect(finished?.moves).toHaveLength(5)
  })

  it('lists the owners in the order of the players, so that the archive knows who was who', () => {
    const finished = finishedGame(playCells(twoPlayers(), xWins))
    expect(finished?.owners).toHaveLength(finished?.players.length ?? -1)
    expect(finished?.owners).toEqual([TOKEN_X, TOKEN_O])
    expect(finished?.players.map(({ id }) => id)).toEqual(['cross', 'circle'])
  })

  it('holds the names that were typed', () => {
    const named = room(
      join(room(join(newRoom(), TOKEN_X, 'Anna', 'cross')), TOKEN_O, undefined, 'circle'),
    )
    expect(finishedGame(playCells(named, xWins))?.players).toEqual([
      { id: 'cross', name: 'Anna' },
      { id: 'circle' },
    ])
  })

  it('is told to the players as the id of the game once the archive has it, until a rematch', () => {
    const over = { ...playCells(twoPlayers(), xWins), gameId: 'abcdefghijklmnop' }
    // Not before: the link would lead to a game that isn't there yet.
    expect(stateFor(over, TOKEN_X, 'BCDF', new Set())).not.toHaveProperty('gameId')

    const kept = { ...over, archived: true }
    expect(stateFor(kept, TOKEN_X, 'BCDF', new Set())?.gameId).toBe('abcdefghijklmnop')
    const again = room(rematch(kept, TOKEN_O))
    expect(again.gameId).toBeUndefined()
    expect(again.archived).toBeUndefined()
    expect(stateFor(again, TOKEN_X, 'BCDF', new Set())).not.toHaveProperty('gameId')
  })
})

describe('choosing a shape', () => {
  it('is possible from the first moment, also alone in the room', () => {
    const alone = room(join(newRoom(), TOKEN_X, undefined))
    expect(room(choose(alone, TOKEN_X, 'heart')).seats[0]?.shape).toBe('heart')
  })

  it('can be changed until the game starts', () => {
    let current = room(join(newRoom(), TOKEN_X, undefined, 'cross'))
    current = room(choose(current, TOKEN_X, 'star'))
    expect(current.seats[0]?.shape).toBe('star')
    current = room(join(current, TOKEN_O, undefined))
    current = room(choose(current, TOKEN_X, 'plus'))
    expect(current.seats[0]?.shape).toBe('plus')
  })

  it('is refused for a shape somebody else has, and for someone without a seat', () => {
    expect(choose(twoPlayers(), TOKEN_Z, 'star')).toEqual({ ok: false, error: 'not-joined' })
    expect(choose(undecided(), TOKEN_X, 'cross').ok).toBe(true)
    const one = room(choose(undecided(), TOKEN_X, 'cross'))
    expect(choose(one, TOKEN_O, 'cross')).toEqual({ ok: false, error: 'shape-taken' })
  })

  it('is fine for the shape you already have', () => {
    expect(choose(room(choose(undecided(), TOKEN_X, 'cross')), TOKEN_X, 'cross').ok).toBe(true)
  })

  it('is too late once the game has started, also in later rounds', () => {
    expect(choose(twoPlayers(), TOKEN_X, 'star')).toEqual({ ok: false, error: 'shape-locked' })
    const later = room(rematch(playCells(twoPlayers(), xWins), TOKEN_X))
    expect(choose(later, TOKEN_O, 'star')).toEqual({ ok: false, error: 'shape-locked' })
  })

  it('starts the game when the last seat has chosen', () => {
    const one = room(choose(undecided(), TOKEN_X, 'star'))
    expect(gameOf(one).kind).toBe('choosing')
    const both = room(choose(one, TOKEN_O, 'heart'))
    const game = gameOf(both)
    expect(game.kind === 'game' && game.game.config.players).toEqual(['star', 'heart'])
  })

  it('makes the shapes the players, in the order of the seats and the round', () => {
    const both = room(choose(room(choose(undecided(), TOKEN_X, 'star')), TOKEN_O, 'heart'))
    const first = room(play(both, TOKEN_X, { x: 0, y: 0 }))
    expect(first.moves).toEqual([{ player: 'star', x: 0, y: 0 }])
    expect(play(both, TOKEN_O, { x: 0, y: 0 })).toEqual({ ok: false, error: 'not-your-turn' })
  })
})

describe('joining with a shape', () => {
  it('takes the shape that was asked for, when it is free', () => {
    expect(room(join(newRoom(), TOKEN_X, undefined, 'heart')).seats[0]?.shape).toBe('heart')
  })

  it('leaves the choice to the player when the shape is taken', () => {
    const first = room(join(newRoom(), TOKEN_X, undefined, 'heart'))
    expect(room(join(first, TOKEN_O, undefined, 'heart')).seats[1]?.shape).toBeUndefined()
  })

  it('does not change the shape of a player who comes back with another one', () => {
    const chosen = room(join(newRoom(), TOKEN_X, undefined, 'heart'))
    expect(room(join(chosen, TOKEN_X, undefined, 'star')).seats[0]?.shape).toBe('heart')
  })

  it('gives a player who comes back without a shape the one that was asked for, if free', () => {
    const noShape = room(join(newRoom(), TOKEN_X, undefined))
    expect(room(join(noShape, TOKEN_X, undefined, 'star')).seats[0]?.shape).toBe('star')
  })
})

describe('a room where somebody has not chosen yet', () => {
  it('is choosing: no moves, no rematch, and no game in the state', () => {
    expect(gameOf(undecided()).kind).toBe('choosing')
    expect(play(undecided(), TOKEN_X, { x: 0, y: 0 })).toEqual({ ok: false, error: 'shape-needed' })
    expect(rematch(undecided(), TOKEN_X)).toEqual({ ok: false, error: 'shape-needed' })
    const state = stateFor(undecided(), TOKEN_X, 'BCDF', new Set())
    expect(state).not.toHaveProperty('config')
    expect(state?.moves).toEqual([])
  })

  it('tells everybody which shape each player has so far', () => {
    const one = room(choose(undecided(), TOKEN_X, 'star'))
    expect(stateFor(one, TOKEN_O, 'BCDF', new Set())?.players).toEqual([
      { id: 'X', shape: 'star', connected: false },
      { id: 'O', connected: false },
    ])
  })

  it('is not over, and keeps no game', () => {
    expect(isOver(undecided())).toBe(false)
    expect(finishedGame(undecided())).toBeNull()
  })
})

describe('a room stored before the shapes were chosen', () => {
  const legacy: RoomState = {
    round: 1,
    seats: [
      { token: TOKEN_X, id: 'X', name: 'Anna' },
      { token: TOKEN_O, id: 'O' },
    ],
    moves: [
      { player: 'O', x: 0, y: 0 },
      { player: 'X', x: 1, y: 1 },
    ],
  }

  it('goes on with the cross for the first seat and the circle for the second', () => {
    const upgraded = upgradeRoom(legacy)
    expect(upgraded.seats.map(({ shape }) => shape)).toEqual(['cross', 'circle'])
    expect(upgraded.moves).toEqual([
      { player: 'circle', x: 0, y: 0 },
      { player: 'cross', x: 1, y: 1 },
    ])
    expect(gameOf(upgraded).kind).toBe('game')
    expect(play(upgraded, TOKEN_O, { x: 2, y: 2 }).ok).toBe(true)
  })

  it('leaves a room in the new form as it is', () => {
    const current = room(play(twoPlayers(), TOKEN_X, { x: 1, y: 1 }))
    expect(upgradeRoom(current)).toBe(current)
    const fresh = undecided()
    expect(upgradeRoom(fresh)).toBe(fresh)
  })
})

describe('the field of a room', () => {
  const big = { width: 7, height: 5, winLength: 5 }
  const bigRoom = (): RoomState => {
    const start = newRoom(big)
    return room(
      choose(
        room(
          choose(
            room(join(room(join(start, TOKEN_X, undefined)), TOKEN_O, undefined)),
            TOKEN_X,
            'star',
          ),
        ),
        TOKEN_O,
        'heart',
      ),
    )
  }

  it('is classic when nothing is asked for, and also for a room stored before this', () => {
    expect(fieldOf(newRoom())).toEqual({ width: 3, height: 3, winLength: 3 })
    expect(fieldOf({ round: 0, seats: [], moves: [] })).toEqual({
      width: 3,
      height: 3,
      winLength: 3,
    })
  })

  it('is the one the room was made with, and the game is played on it', () => {
    const current = bigRoom()
    expect(fieldOf(current)).toEqual(big)
    const game = gameOf(current)
    expect(game.kind === 'game' && game.game.config).toMatchObject(big)
    expect(game.kind === 'game' && game.game.cells).toHaveLength(35)
    expect(room(play(current, TOKEN_X, { x: 6, y: 4 })).moves).toEqual([
      { player: 'star', x: 6, y: 4 },
    ])
  })

  it('refuses a move outside the field of this room, and takes one a classic room would refuse', () => {
    expect(play(bigRoom(), TOKEN_X, { x: 7, y: 0 })).toEqual({ ok: false, error: 'out-of-bounds' })
    expect(play(twoPlayers(), TOKEN_X, { x: 6, y: 4 })).toEqual({
      ok: false,
      error: 'out-of-bounds',
    })
  })

  it('is told to the players from the first moment, also before the game', () => {
    const alone = room(join(newRoom(big), TOKEN_X, undefined))
    expect(stateFor(alone, TOKEN_X, 'BCDF', new Set())?.field).toEqual(big)
    expect(stateFor(alone, TOKEN_X, 'BCDF', new Set())).not.toHaveProperty('config')
    expect(stateFor(bigRoom(), TOKEN_O, 'BCDF', new Set())?.config).toMatchObject(big)
  })

  it('stays the same in a rematch', () => {
    let current = bigRoom()
    // Five in a row along the long side wins: (0..4, 0) for the star, the heart plays row 1.
    for (const [token, x, y] of [
      [TOKEN_X, 0, 0],
      [TOKEN_O, 0, 1],
      [TOKEN_X, 1, 0],
      [TOKEN_O, 1, 1],
      [TOKEN_X, 2, 0],
      [TOKEN_O, 2, 1],
      [TOKEN_X, 3, 0],
      [TOKEN_O, 3, 1],
      [TOKEN_X, 4, 0],
    ] as const) {
      current = room(play(current, token, { x, y }))
    }
    expect(isOver(current)).toBe(true)
    const next = room(rematch(current, TOKEN_X))
    expect(fieldOf(next)).toEqual(big)
    expect(next.moves).toEqual([])
  })

  it('is kept in the game that is stored', () => {
    const finished = finishedGame(
      ((): RoomState => {
        let current = bigRoom()
        for (const [token, x, y] of [
          [TOKEN_X, 0, 0],
          [TOKEN_O, 0, 1],
          [TOKEN_X, 1, 0],
          [TOKEN_O, 1, 1],
          [TOKEN_X, 2, 0],
          [TOKEN_O, 2, 1],
          [TOKEN_X, 3, 0],
          [TOKEN_O, 3, 1],
          [TOKEN_X, 4, 0],
        ] as const) {
          current = room(play(current, token, { x, y }))
        }
        return current
      })(),
    )
    expect(finished?.config).toMatchObject(big)
    expect(finished?.result).toEqual({ kind: 'won', winner: 'star' })
  })
})

describe('a room for more than two people', () => {
  const TOKENS = ['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20), 'd'.repeat(20), 'e'.repeat(20)]
  const SHAPES = ['cross', 'circle', 'star', 'heart', 'fort'] as const
  const field = { width: 7, height: 7, winLength: 5 }

  /** A room with this many seats, with this many people in it who have chosen their shapes. */
  function seated(seats: number, people: number, chosen = people): RoomState {
    let current = newRoom(field, seats)
    for (let i = 0; i < people; i++) {
      current = room(join(current, TOKENS[i] ?? '', undefined, i < chosen ? SHAPES[i] : undefined))
    }
    return current
  }

  it('has two seats when nothing is asked for, also for a room from before', () => {
    expect(seatCountOf(newRoom())).toBe(2)
    expect(seatCountOf({ round: 0, seats: [], moves: [] })).toBe(2)
    expect(seatCountOf(newRoom(field, 5))).toBe(5)
  })

  it('seats the people in the order they come, the first two as they always were named', () => {
    expect(seated(5, 5).seats.map(({ id }) => id)).toEqual(['X', 'O', '3', '4', '5'])
  })

  it('refuses somebody new when every seat is taken, and gives a seat back to who has one', () => {
    const full = seated(3, 3)
    expect(join(full, TOKENS[3] ?? '', undefined)).toEqual({ ok: false, error: 'room-full' })
    expect(room(join(full, TOKENS[1] ?? '', undefined)).seats).toHaveLength(3)
  })

  it('waits for every seat to be taken, and for every shape, before the game starts by itself', () => {
    expect(gameOf(seated(3, 2)).kind).toBe('waiting')
    expect(gameOf(seated(3, 3, 2)).kind).toBe('choosing')
    expect(gameOf(seated(3, 3)).kind).toBe('game')
  })

  it('plays with all the shapes, in the order of the seats, and each player moves in turn', () => {
    let current = seated(3, 3)
    const game = gameOf(current)
    expect(game.kind === 'game' && game.game.config.players).toEqual(['cross', 'circle', 'star'])
    current = room(play(current, TOKENS[0] ?? '', { x: 0, y: 0 }))
    expect(play(current, TOKENS[2] ?? '', { x: 1, y: 0 })).toEqual({
      ok: false,
      error: 'not-your-turn',
    })
    current = room(play(current, TOKENS[1] ?? '', { x: 1, y: 0 }))
    current = room(play(current, TOKENS[2] ?? '', { x: 2, y: 0 }))
    current = room(play(current, TOKENS[0] ?? '', { x: 0, y: 1 }))
    expect(current.moves.map(({ player }) => player)).toEqual(['cross', 'circle', 'star', 'cross'])
  })

  it('moves the starting player one seat on in every round, and back round to the first', () => {
    const rotation = (round: number) => {
      const current = { ...seated(3, 3), round }
      const game = gameOf(current)
      return game.kind === 'game' ? game.game.config.players : []
    }
    expect(rotation(0)).toEqual(['cross', 'circle', 'star'])
    expect(rotation(1)).toEqual(['circle', 'star', 'cross'])
    expect(rotation(2)).toEqual(['star', 'cross', 'circle'])
    expect(rotation(3)).toEqual(['cross', 'circle', 'star'])
  })

  it('has a winner who is any of them, and keeps the seats and the field in a rematch', () => {
    let current = seated(3, 3)
    // The star (third seat) plays the top row, the others play elsewhere.
    const turns: [number, number, number][] = [
      [0, 0, 6],
      [1, 1, 6],
      [2, 0, 0],
      [0, 2, 6],
      [1, 3, 6],
      [2, 1, 0],
      [0, 4, 6],
      [1, 5, 6],
      [2, 2, 0],
      [0, 6, 5],
      [1, 6, 4],
      [2, 3, 0],
      [0, 5, 5],
      [1, 5, 4],
      [2, 4, 0],
    ]
    for (const [seat, x, y] of turns) current = room(play(current, TOKENS[seat] ?? '', { x, y }))
    expect(isOver(current)).toBe(true)
    const finished = finishedGame(current)
    expect(finished?.result).toEqual({ kind: 'won', winner: 'star' })
    expect(finished?.players.map(({ id }) => id)).toEqual(['cross', 'circle', 'star'])
    expect(finished?.owners).toHaveLength(3)

    const next = room(rematch(current, TOKENS[1] ?? ''))
    expect(seatCountOf(next)).toBe(3)
    expect(fieldOf(next)).toEqual(field)
    expect(next.seats).toHaveLength(3)
  })

  it('tells the players how many seats there are, taken or not', () => {
    const state = stateFor(seated(5, 2), TOKENS[0] ?? '', 'BCDF', new Set())
    expect(state?.seats).toBe(5)
    expect(state?.players).toHaveLength(2)
  })

  describe('starting the game with the people who are there', () => {
    it('is for the one who made the room, with two or more people who have all chosen', () => {
      const started = room(startGame(seated(5, 3), TOKENS[0] ?? ''))
      expect(started.started).toBe(true)
      const game = gameOf(started)
      expect(game.kind === 'game' && game.game.config.players).toEqual(['cross', 'circle', 'star'])
    })

    it('is not for anybody else', () => {
      expect(startGame(seated(5, 3), TOKENS[1] ?? '')).toEqual({ ok: false, error: 'not-host' })
      expect(startGame(seated(5, 3), TOKENS[4] ?? '')).toEqual({ ok: false, error: 'not-joined' })
    })

    it('is not possible alone, nor while somebody has not chosen a shape', () => {
      expect(startGame(seated(5, 1), TOKENS[0] ?? '')).toEqual({
        ok: false,
        error: 'not-enough-players',
      })
      expect(startGame(seated(5, 3, 2), TOKENS[0] ?? '')).toEqual({
        ok: false,
        error: 'shape-needed',
      })
    })

    it('is not needed, and not possible, once every seat is taken and the game is on', () => {
      expect(startGame(seated(3, 3), TOKENS[0] ?? '')).toEqual({ ok: false, error: 'game-started' })
      expect(startGame(room(startGame(seated(5, 3), TOKENS[0] ?? '')), TOKENS[0] ?? '')).toEqual({
        ok: false,
        error: 'game-started',
      })
    })

    it('closes the room to others, who are told the game has started, but not to those who sit', () => {
      const started = room(startGame(seated(5, 3), TOKENS[0] ?? ''))
      expect(join(started, TOKENS[3] ?? '', undefined)).toEqual({
        ok: false,
        error: 'game-started',
      })
      expect(room(join(started, TOKENS[2] ?? '', undefined)).seats).toHaveLength(3)
    })

    it('keeps the people who played in a rematch, with seats left over', () => {
      let current = room(startGame(seated(5, 3), TOKENS[0] ?? ''))
      expect(isOver(current)).toBe(false)
      // Make the game end quickly: the cross plays the top row with the others elsewhere.
      for (const [seat, x, y] of [
        [0, 0, 0],
        [1, 0, 6],
        [2, 0, 5],
        [0, 1, 0],
        [1, 1, 6],
        [2, 1, 5],
        [0, 2, 0],
        [1, 2, 6],
        [2, 2, 5],
        [0, 3, 0],
        [1, 3, 6],
        [2, 3, 5],
        [0, 4, 0],
      ] as const) {
        current = room(play(current, TOKENS[seat] ?? '', { x, y }))
      }
      expect(isOver(current)).toBe(true)
      const next = room(rematch(current, TOKENS[2] ?? ''))
      expect(next.started).toBe(true)
      expect(gameOf(next).kind).toBe('game')
      expect(join(next, TOKENS[3] ?? '', undefined)).toEqual({ ok: false, error: 'game-started' })
    })
  })
})
