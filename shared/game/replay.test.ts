import { describe, expect, it } from 'vitest'
import { applyMove, createGame, replayGame, stateAfter } from './index.ts'
import type { GameConfig, GameState, Move } from './index.ts'

const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

/** Plays the cells in turn order and expects every move to be legal. */
function play(config: GameConfig, cells: readonly (readonly [number, number])[]): GameState {
  return cells.reduce((state, [x, y]) => {
    if (state.status.kind !== 'playing') throw new Error(`the game ended before (${x}, ${y})`)
    const result = applyMove(state, { player: state.status.next, x, y })
    if (!result.ok) throw new Error(`(${x}, ${y}) was refused: ${result.error}`)
    return result.state
  }, createGame(config))
}

// X wins on the top row; O has two marks on the middle row.
const won = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [2, 0],
] as const

describe('the move history', () => {
  it('is empty when a game starts', () => {
    expect(createGame(classic).moves).toEqual([])
  })

  it('keeps every move in order, with the player who made it', () => {
    expect(play(classic, won).moves).toEqual([
      { player: 'X', x: 0, y: 0 },
      { player: 'O', x: 0, y: 1 },
      { player: 'X', x: 1, y: 0 },
      { player: 'O', x: 1, y: 1 },
      { player: 'X', x: 2, y: 0 },
    ])
  })

  it('keeps only what the engine knows about a move', () => {
    const result = applyMove(createGame(classic), { player: 'X', x: 1, y: 1, extra: 'no' } as Move)
    if (!result.ok) throw new Error(result.error)
    expect(result.state.moves).toStrictEqual([{ player: 'X', x: 1, y: 1 }])
  })

  it('leaves out a refused move and does not change the earlier state', () => {
    const before = play(classic, [[1, 1]])
    expect(applyMove(before, { player: 'O', x: 1, y: 1 }).ok).toBe(false)
    expect(before.moves).toHaveLength(1)
    const after = applyMove(before, { player: 'O', x: 0, y: 0 })
    if (!after.ok) throw new Error(after.error)
    expect(before.moves).toHaveLength(1)
    expect(after.state.moves).toHaveLength(2)
  })
})

describe('replayGame', () => {
  it('leads to the same state as playing the game', () => {
    const played = play(classic, won)
    const result = replayGame(classic, played.moves)
    expect(result).toEqual({ ok: true, state: played })
  })

  it('gives an empty field for no moves', () => {
    expect(replayGame(classic, [])).toEqual({ ok: true, state: createGame(classic) })
  })

  it('refuses a move on a taken cell, and says which move it was', () => {
    const moves: Move[] = [
      { player: 'X', x: 1, y: 1 },
      { player: 'O', x: 0, y: 0 },
      { player: 'X', x: 1, y: 1 },
    ]
    expect(replayGame(classic, moves)).toEqual({ ok: false, index: 2, error: 'cell-taken' })
  })

  it('refuses a move out of turn', () => {
    const moves: Move[] = [
      { player: 'X', x: 0, y: 0 },
      { player: 'X', x: 1, y: 0 },
    ]
    expect(replayGame(classic, moves)).toEqual({ ok: false, index: 1, error: 'not-your-turn' })
  })

  it('refuses a move outside the field', () => {
    expect(replayGame(classic, [{ player: 'X', x: 3, y: 0 }])).toEqual({
      ok: false,
      index: 0,
      error: 'out-of-bounds',
    })
  })

  it('refuses a move after the game has ended', () => {
    const moves = [...play(classic, won).moves, { player: 'O', x: 2, y: 2 }]
    expect(replayGame(classic, moves)).toEqual({ ok: false, index: 5, error: 'game-over' })
  })

  it('refuses a config that can not make a game', () => {
    expect(() => replayGame({ ...classic, winLength: 9 }, [])).toThrow(RangeError)
  })

  it('works with more players on a bigger field', () => {
    const config: GameConfig = { width: 12, height: 9, winLength: 4, players: ['A', 'B', 'C'] }
    const played = play(config, [
      [0, 0], // A
      [5, 5], // B
      [9, 8], // C
      [1, 1], // A
      [5, 6], // B
      [9, 7], // C
      [2, 2], // A
      [5, 7], // B
      [9, 6], // C
      [3, 3], // A: four on a diagonal
    ])
    expect(played.status).toMatchObject({ kind: 'won', winner: 'A' })
    expect(replayGame(config, played.moves)).toEqual({ ok: true, state: played })
  })
})

describe('stateAfter', () => {
  const game = play(classic, won)

  it('is the empty field after 0 moves', () => {
    expect(stateAfter(game, 0)).toEqual(createGame(classic))
  })

  it('is the game itself after all its moves', () => {
    expect(stateAfter(game, 5)).toEqual(game)
  })

  it('is the state at that moment in between, with whose turn it was', () => {
    const third = stateAfter(game, 3)
    expect(third.moveCount).toBe(3)
    expect(third.moves).toEqual(game.moves.slice(0, 3))
    expect(third.cells).toEqual(['X', 'X', null, 'O', null, null, null, null, null])
    expect(third.status).toEqual({ kind: 'playing', next: 'O' })
  })

  it('shows the win only at the last move', () => {
    const kinds = Array.from({ length: 6 }, (_, count) => stateAfter(game, count).status.kind)
    expect(kinds).toEqual(['playing', 'playing', 'playing', 'playing', 'playing', 'won'])
  })

  it('can be played on from, because it is a state like any other', () => {
    const result = applyMove(stateAfter(game, 2), { player: 'X', x: 2, y: 2 })
    expect(result.ok).toBe(true)
  })

  it('does not change the game it starts from', () => {
    const before = structuredClone(game)
    stateAfter(game, 2)
    expect(game).toEqual(before)
  })

  it.each([-1, 6, 1.5, Number.NaN])('refuses %s moves', (count) => {
    expect(() => stateAfter(game, count)).toThrow(RangeError)
  })
})

describe('every game of classic tic-tac-toe', () => {
  it('replays to the same state, and steps back to the state before each move', () => {
    const sameState = (a: GameState, b: GameState) => JSON.stringify(a) === JSON.stringify(b)
    let games = 0
    const problems: string[] = []

    const explore = (state: GameState, parent: GameState | null): void => {
      if (parent && !sameState(stateAfter(state, state.moves.length - 1), parent)) {
        problems.push(`stepping back from ${JSON.stringify(state.moves)}`)
      }
      if (state.status.kind !== 'playing') {
        games++
        const replayed = replayGame(classic, state.moves)
        if (!replayed.ok || !sameState(replayed.state, state)) {
          problems.push(`replaying ${JSON.stringify(state.moves)}`)
        }
        return
      }
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const result = applyMove(state, { player: state.status.next, x, y })
          if (result.ok) explore(result.state, state)
        }
      }
    }
    explore(createGame(classic), null)

    expect(problems.slice(0, 3)).toEqual([])
    expect(games).toBe(255_168)
  }, 60_000)
})
