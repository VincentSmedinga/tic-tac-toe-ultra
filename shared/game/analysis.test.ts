import { describe, expect, it } from 'vitest'
import { symmetriesOf } from './analysis.ts'
import {
  analyseGame,
  applyMove,
  cellCount,
  createGame,
  hasCell,
  OUTLINES,
  RANK_SYMBOLS,
  RANKS,
  Solver,
  summariseGame,
} from './index.ts'
import type { GameAnalysis, GameConfig, GameState, Move, Rank } from './index.ts'

const classic: GameConfig = { width: 3, height: 3, winLength: 3, players: ['X', 'O'] }

/** A game from the cells that were played, as `y * width + x`, the players taking turns. */
function movesOf(config: GameConfig, cells: readonly number[]): Move[] {
  return cells.map((index, turn) => ({
    player: config.players[turn % config.players.length] ?? 'nobody',
    x: index % config.width,
    y: Math.floor(index / config.width),
  }))
}

function analyse(
  config: GameConfig,
  cells: readonly number[],
  limits?: Parameters<typeof analyseGame>[2],
): GameAnalysis {
  const analysis = analyseGame(config, movesOf(config, cells), limits)
  if (analysis === null) throw new Error('the game can not be read')
  return analysis
}

const ranks = (analysis: GameAnalysis): (Rank | null)[] => analysis.moves.map(({ rank }) => rank)
const cell = (index: number, width: number) => ({ x: index % width, y: Math.floor(index / width) })

describe('the ranks', () => {
  it('has a symbol for each rank, from the best to the worst', () => {
    expect(RANKS.map((rank) => RANK_SYMBOLS[rank])).toEqual(['!!', '!', '?!', '?', '??'])
  })
})

describe('analyseGame', () => {
  it('is null for a game that can not be read', () => {
    expect(analyseGame(classic, [{ player: 'O', x: 0, y: 0 }])).toBeNull()
  })

  it('has an answer for every move, and none for a game without moves', () => {
    expect(analyse(classic, [])).toEqual({ moves: [], certainty: 'exact' })
    expect(analyse(classic, [4, 0, 8]).moves).toHaveLength(3)
  })

  describe('3 × 3, exactly', () => {
    it('solves a whole game, and says what the field was worth at the start', () => {
      const analysis = analyse(classic, [0, 1, 4, 8, 6, 3, 2])
      expect(analysis.certainty).toBe('exact')
      expect(analysis.moves.every(({ certainty }) => certainty === 'exact')).toBe(true)
      expect(analysis.moves[0]?.value).toBe('draw')
    })

    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])(
      'never calls the first move on cell %i a mistake or a blunder: all nine keep the draw',
      (index) => {
        const [first] = analyse(classic, [index]).moves
        expect(first?.value).toBe('draw')
        expect(first?.rank).not.toBe('mistake')
        expect(first?.rank).not.toBe('blunder')
      },
    )

    it('calls a draw thrown away a blunder, and says which moves were better', () => {
      // X plays a corner and O answers beside it: only the middle keeps the draw.
      const [, reply] = analyse(classic, [0, 1]).moves
      expect(reply?.rank).toBe('blunder')
      expect(reply?.value).toBe('draw')
      expect(reply?.better).toEqual([cell(4, 3)])
    })

    it('calls a win given up for a draw a mistake', () => {
      // After X0 O1 the game is won for X: X2 lets it go, and 4 or 6 or 8 would have kept it.
      const [, , third] = analyse(classic, [0, 1, 2]).moves
      expect(third?.value).toBe('win')
      expect(third?.rank).toBe('mistake')
      expect(third?.better.length).toBeGreaterThan(0)
    })

    it('calls a win turned into a loss a blunder', () => {
      // X could win at 6 at once, and plays 8: O wins at 7.
      const analysis = analyse(classic, [0, 1, 3, 4, 8])
      expect(analysis.moves[4]?.value).toBe('win')
      expect(analysis.moves[4]?.rank).toBe('blunder')
      expect(analysis.moves[4]?.better).toEqual([cell(6, 3)])
    })

    it('calls the only move that keeps the value good', () => {
      // X has 0 and 2: O must take the middle of the top row's... the middle, 4.
      const analysis = analyse(classic, [0, 1, 2, 4])
      expect(analysis.moves[3]?.rank).toBe('good')
    })

    it('calls a fork that was the only winning move brilliant', () => {
      // X0 O1 X2 O7 X4: the middle threatens 8 and 6 at once.
      const analysis = analyse(classic, [0, 1, 2, 7, 4])
      expect(analysis.moves[4]?.rank).toBe('brilliant')
      expect(analysis.moves[4]?.value).toBe('win')
    })

    it('calls a win that is kept but comes later dubious', () => {
      // X could win at once at 6; 4 keeps the win but takes longer.
      const analysis = analyse(classic, [0, 1, 3, 2, 4])
      expect(analysis.moves[4]?.rank).toBe('dubious')
    })

    it('gives the move that wins no mark', () => {
      const analysis = analyse(classic, [0, 1, 4, 8, 6, 3, 2])
      expect(analysis.moves[6]?.rank).toBeNull()
      expect(analysis.moves[6]?.value).toBe('win')
    })

    it('gives a position that is turned or mirrored the same ranks and values', () => {
      const game = [0, 1, 4, 8, 6, 3, 2]
      const turn = (index: number) => (index % 3) * 3 + (2 - Math.floor(index / 3))
      const mirror = (index: number) => Math.floor(index / 3) * 3 + (2 - (index % 3))
      for (const map of [turn, mirror, (index: number) => mirror(turn(index))]) {
        const other = analyse(classic, game.map(map))
        expect(ranks(other)).toEqual(ranks(analyse(classic, game)))
        expect(other.moves.map(({ value }) => value)).toEqual(
          analyse(classic, game).moves.map(({ value }) => value),
        )
      }
    })

    it('follows the rules of the values for every move in every position', () => {
      // An independent solution: the value of a position for the player to move by plain
      // minimax with a table, and from it the value of every move.
      const values = new Map<string, number>()
      const valueOf = (state: GameState): number => {
        const key = state.cells.map((mark) => mark ?? '.').join('')
        const known = values.get(key)
        if (known !== undefined) return known
        let best = -1
        for (let index = 0; index < 9; index++) {
          if (state.cells[index] !== null || state.status.kind !== 'playing') continue
          const result = applyMove(state, {
            player: state.status.next,
            x: index % 3,
            y: Math.floor(index / 3),
          })
          if (!result.ok) continue
          const { status } = result.state
          const score =
            status.kind === 'won' ? 1 : status.kind === 'draw' ? 0 : -valueOf(result.state)
          best = Math.max(best, score)
        }
        values.set(key, best)
        return best
      }

      const solver = new Solver(classic, 1_000_000)
      const seen = new Set<string>()
      const failures: string[] = []
      let checked = 0
      const walk = (state: GameState): void => {
        if (state.status.kind !== 'playing') return
        const key = state.cells.map((mark) => mark ?? '.').join('')
        if (seen.has(key)) return
        seen.add(key)

        const position = valueOf(state)
        const moves: { index: number; value: number; won: boolean; next: GameState }[] = []
        for (let index = 0; index < 9; index++) {
          if (state.cells[index] !== null) continue
          const result = applyMove(state, {
            player: state.status.next,
            x: index % 3,
            y: Math.floor(index / 3),
          })
          if (!result.ok) continue
          const { status } = result.state
          const value =
            status.kind === 'won' ? 1 : status.kind === 'draw' ? 0 : -valueOf(result.state)
          moves.push({ index, value, won: status.kind === 'won', next: result.state })
        }
        const keepers = moves.filter(({ value }) => value === position).length
        for (const { index, value, won, next } of moves) {
          const move = next.moves.at(-1)
          if (move === undefined) throw new Error('a move was played')
          const rank = analyseGame(classic, [...state.moves, move], { solver })?.moves.at(-1)
          checked++
          const where = `${state.moves.map(({ x, y }) => y * 3 + x).join('')}+${index.toString()}`
          if (rank?.value !== (position > 0 ? 'win' : position < 0 ? 'loss' : 'draw'))
            failures.push(`${where}: the value of the position`)
          if (value < position && rank?.rank !== 'mistake' && rank?.rank !== 'blunder')
            failures.push(`${where}: a move that gave up value is not a mistake or blunder`)
          if (value < position && position === 1 && value === 0 && rank?.rank !== 'mistake')
            failures.push(`${where}: a win given up for a draw is a mistake`)
          if (value < position && value === -1 && rank?.rank !== 'blunder')
            failures.push(`${where}: a loss is a blunder`)
          if (value >= position && (rank?.rank === 'mistake' || rank?.rank === 'blunder'))
            failures.push(`${where}: a move that keeps the value is no mistake`)
          if (rank?.rank === 'good' && !(keepers === 1 && value === position))
            failures.push(`${where}: good is the only move that keeps the value`)
          if (won && rank?.rank !== null) failures.push(`${where}: a winning move has no mark`)
          if (value < position && !(rank?.better ?? []).length)
            failures.push(`${where}: a mistake says what was better`)
          if (keepers === 1 && value === position && !won && moves.length > 1 && !rank?.rank)
            failures.push(`${where}: the only move that keeps the value is good`)
        }
        for (const { next } of moves) walk(next)
      }
      walk(createGame(classic))
      expect(failures).toEqual([])
      // Every reachable position that is still in play: 4,520 of the 5,478 of the whole game.
      expect(seen.size).toBeGreaterThan(4000)
      expect(checked).toBeGreaterThan(15_000)
    })
  })

  describe('tactically', () => {
    const five: GameConfig = { width: 5, height: 5, winLength: 4, players: ['A', 'B'] }

    it('is tactical, with no value, when the field is too big to solve', () => {
      const analysis = analyse(five, [12, 0, 13])
      expect(analysis.certainty).toBe('tactical')
      expect(analysis.moves.every(({ certainty }) => certainty === 'tactical')).toBe(true)
      expect(analysis.moves.every(({ value }) => value === null)).toBe(true)
    })

    it('gives no rank to an ordinary move', () => {
      expect(ranks(analyse(five, [12, 0, 13])).every((rank) => rank === null)).toBe(true)
    })

    it('calls a win in one move that was missed a mistake, and says where it was', () => {
      // A has the row 6, 7, 8 and wins at 5 or 9; B is nowhere near; A plays the middle instead.
      const analysis = analyse(five, [6, 20, 7, 24, 8, 4, 12])
      expect(analysis.moves[6]?.rank).toBe('mistake')
      expect(analysis.moves[6]?.better).toEqual([cell(5, 5), cell(9, 5)])
    })

    it('calls a missed win a blunder when the next player wins at once', () => {
      // B has 20, 21, 22 and wins at 23; A has 6, 7, 8 and wins at 5 or 9 and plays 24.
      const analysis = analyse(five, [6, 20, 7, 21, 8, 22, 24])
      expect(analysis.moves[6]?.rank).toBe('blunder')
    })

    it('calls a win of the next player that was not blocked a blunder, and the block good', () => {
      // B has 20, 21, 22 and wins at 23.
      const missed = analyse(five, [1, 20, 3, 21, 7, 22, 2])
      expect(missed.moves[6]?.rank).toBe('blunder')
      expect(missed.moves[6]?.better).toEqual([cell(23, 5)])
      const stopped = analyse(five, [1, 20, 3, 21, 7, 22, 23])
      expect(stopped.moves[6]?.rank).toBe('good')
    })

    it('gives no blame when there were two wins to stop and only one move', () => {
      // B has 20, 21, 22 and 24? no: B has 20, 21, 22 and the other end is off the field; use two
      // lines: B holds 6, 7, 8 (wins at 5 and 9).
      const analysis = analyse(five, [0, 6, 24, 7, 4, 8, 12])
      expect(analysis.moves[6]?.rank).toBeNull()
    })

    it('calls a double threat for two players brilliant when it was the only one', () => {
      // A has 6 and 8: 7 makes three in a row that can be finished at both ends.
      const analysis = analyse(five, [6, 0, 8, 24, 7])
      expect(analysis.moves[4]?.rank).toBe('brilliant')
    })

    it('calls a double threat of several players good: the others may stop it in between', () => {
      const three: GameConfig = { width: 5, height: 5, winLength: 4, players: ['A', 'B', 'C'] }
      const analysis = analyse(three, [6, 0, 24, 8, 4, 20, 7])
      expect(analysis.moves[6]?.rank).toBe('good')
    })

    it('calls a move that hands the opponent a double threat a blunder, when another move was safe', () => {
      // B has 7 and 12 (and 17 would make three in a column); A, with nothing, plays far away
      // and lets B make the double threat 12-17 with 7: it wins at both ends of the column.
      const analysis = analyse(five, [0, 7, 24, 12, 4])
      // After B has 7 and 12 in a column of five and A plays 4, B plays 17: 7-12-17 can be finished
      // at 2 and 22. The move that allowed it is A's 4 (index 4); 2 or 17 was safe.
      expect(analysis.moves[4]?.rank).toBe('blunder')
      expect(analysis.moves[4]?.better).toEqual([])
    })

    it('judges several players for the one who moved, with tactics only', () => {
      const three: GameConfig = { width: 6, height: 6, winLength: 3, players: ['A', 'B', 'C'] }
      // A has 0 and 1 and wins at 2, and plays 20.
      const analysis = analyse(three, [0, 30, 31, 1, 32, 33, 20])
      expect(analysis.certainty).toBe('tactical')
      expect(analysis.moves[6]?.rank).toBe('mistake')
      expect(analysis.moves[6]?.better).toEqual([cell(2, 6)])
      expect(analysis.moves[1]?.rank).toBeNull()
    })

    it('does not judge a move played after the game was drawn', () => {
      // A game stored before dead positions ended it was played on to a full field.
      const dead: GameConfig = { width: 3, height: 1, winLength: 3, players: ['A', 'B'] }
      const analysis = analyse(dead, [0, 1, 2])
      expect(analysis.moves.at(-1)?.rank).toBeNull()
      expect(analysis.moves.at(-1)?.certainty).toBe('tactical')
    })
  })

  describe('the limits', () => {
    it('gives up exact answers when the budget is spent, and falls back on tactics', () => {
      const analysis = analyse(classic, [0, 1, 4, 8, 6, 3, 2], { nodes: 300 })
      expect(analysis.certainty).toBe('tactical')
      // The end of the game is solved first and fits; the start does not.
      expect(analysis.moves[6]?.certainty).toBe('exact')
      expect(analysis.moves[0]?.certainty).toBe('tactical')
      expect(analysis.moves[0]?.value).toBeNull()
    })

    it('does not solve a field with more cells than it can', () => {
      const six: GameConfig = { width: 7, height: 7, winLength: 4, players: ['A', 'B'] }
      expect(analyse(six, [24, 0, 25]).certainty).toBe('tactical')
    })

    it('keeps what a solver has solved for the next game on the same field', () => {
      const solver = new Solver(classic, 1_000_000)
      const first = analyse(classic, [0, 1, 2, 4], { solver })
      // A second game, with other shapes, gets the same answers from the kept solver.
      const other: GameConfig = { ...classic, players: ['star', 'heart'] }
      const second = analyse(other, [0, 1, 2, 4], { solver, nodes: 40 })
      expect(ranks(second)).toEqual(ranks(first))
      expect(second.certainty).toBe('exact')
    })

    it('stays fast on a field of 19 × 19 with 12 players and a long game', () => {
      const config: GameConfig = {
        width: 19,
        height: 19,
        winLength: 5,
        players: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'],
      }
      // Scatter the marks so that nobody gets five in a row: a long game.
      const cells = [...new Set(Array.from({ length: 300 }, (_, index) => (index * 7) % 361))]
      const started = performance.now()
      const analysis = analyseGame(config, movesOf(config, cells))
      expect(analysis?.certainty).toBe('tactical')
      expect(analysis?.moves).toHaveLength(cells.length)
      expect(performance.now() - started).toBeLessThan(2000)
    })

    it('stays fast on a field of 19 × 19 with two players and a long game', () => {
      const config: GameConfig = { width: 19, height: 19, winLength: 5, players: ['A', 'B'] }
      const cells = [...new Set(Array.from({ length: 300 }, (_, index) => (index * 7) % 361))]
      const started = performance.now()
      const analysis = analyseGame(config, movesOf(config, cells))
      expect(analysis?.moves).toHaveLength(cells.length)
      expect(performance.now() - started).toBeLessThan(3000)
    })
  })
})

describe('summariseGame', () => {
  const summary = (config: GameConfig, cells: readonly number[]) => {
    const moves = movesOf(config, cells)
    const analysis = analyseGame(config, moves)
    if (analysis === null) throw new Error('the game can not be read')
    return summariseGame(config, moves, analysis)
  }

  it('counts the ranks of each player, the best move and the biggest mistake', () => {
    // X0 O1 (a blunder) X2 (a mistake) O7 (a blunder) X4 (a fork) O8 X6 (wins).
    const result = summary(classic, [0, 1, 2, 7, 4, 8, 6])
    expect(result.certainty).toBe('exact')
    const [x, o] = result.players
    expect(x?.player).toBe('X')
    expect(x?.moves).toBe(4)
    expect(o?.moves).toBe(3)
    expect(o?.counts).toEqual({ brilliant: 0, good: 0, dubious: 0, mistake: 0, blunder: 2 })
    expect(x?.counts).toEqual({ brilliant: 1, good: 0, dubious: 0, mistake: 1, blunder: 0 })
    // The biggest mistake of O is its first blunder; X has no blunder, so its mistake counts.
    expect(o?.worst).toBe(1)
    expect(x?.worst).toBe(2)
    expect(x?.best).toBe(4)
    expect(o?.best).toBeNull()
  })

  it('works out the accuracy from the moves that were solved exactly', () => {
    const [x, o] = summary(classic, [0, 1, 2, 7, 4, 8, 6]).players
    expect(x?.judged).toBe(4)
    expect(x?.accuracy).toBeCloseTo(3 / 4)
    expect(o?.judged).toBe(3)
    expect(o?.accuracy).toBeCloseTo(1 / 3)
  })

  it('picks a blunder over an earlier mistake, and a brilliant move over an earlier good one', () => {
    // O takes the middle against a corner (the only move that holds the draw) and then blocks the
    // top row (the only block): two good moves, and the first one is the best.
    const [, o] = summary(classic, [0, 4, 1, 2]).players
    expect(o?.counts.good).toBe(2)
    expect(o?.best).toBe(1)
  })

  it('leaves out players who never moved, and has no accuracy without exact moves', () => {
    const three: GameConfig = { width: 6, height: 6, winLength: 3, players: ['A', 'B', 'C'] }
    const result = summary(three, [0, 30])
    expect(result.certainty).toBe('tactical')
    expect(result.players.map(({ player }) => player)).toEqual(['A', 'B'])
    expect(result.players.every(({ accuracy }) => accuracy === null)).toBe(true)
  })

  it('reads the stored games of the old players X and O like any other', () => {
    const result = summary(classic, [4, 0, 8])
    expect(result.players.map(({ player }) => player)).toEqual(['X', 'O'])
  })
})

describe('an outline', () => {
  const config: GameConfig = {
    width: OUTLINES.pyramid.width,
    height: OUTLINES.pyramid.height,
    winLength: 5,
    players: ['A', 'B'],
    outline: 'pyramid',
  }
  const { width, height } = config
  const rectangle: GameConfig = { width, height, winLength: 5, players: ['A', 'B'] }
  const plus: GameConfig = {
    width: 9,
    height: 9,
    winLength: 5,
    players: ['A', 'B'],
    outline: 'plus',
  }

  it.each([
    ['the pyramid, only left and right', config, 2],
    ['a rectangle of the same size', rectangle, 4],
    ['the plus, every turn and mirror', plus, 8],
  ])('is turned and mirrored as it allows: %s', (_name, field, count) => {
    const orders = symmetriesOf(field)
    expect(orders).toHaveLength(count)
    for (const order of orders) {
      for (const [to, from] of order.entries()) {
        const exists = (index: number) => {
          const { x, y } = cell(index, field.width)
          return hasCell(field, x, y)
        }
        expect(exists(from)).toBe(exists(to))
      }
    }
  })

  it('does not share a solver with the rectangle around it', () => {
    expect(new Solver(config, 0).fits(config)).toBe(true)
    expect(new Solver(config, 0).fits(rectangle)).toBe(false)
    expect(new Solver(rectangle, 0).fits(config)).toBe(false)
  })

  it('solves only the cells of the field', () => {
    const open = [6, 6 * width, 6 * width + 12]
    // Pairs that move on every row, so that nobody has five alike.
    const cells = Array.from({ length: width * height }, (_, index) => {
      const { x, y } = cell(index, width)
      if (!hasCell(config, x, y) || open.includes(index)) return null
      return (x + 2 * y) % 4 < 2 ? 'A' : 'B'
    })
    const state: GameState = {
      ...createGame(config),
      cells,
      moveCount: cellCount(config) - open.length,
    }
    const scores = new Solver(config, 1000).scores(state)
    expect([...(scores?.keys() ?? [])]).toEqual(open)
  })

  it('ranks the moves, and never says a cell beside the field was better', () => {
    const at = (x: number, y: number) => y * width + x
    // A has four on the bottom row and then plays somewhere else.
    const analysis = analyse(config, [
      at(0, 6),
      at(6, 0),
      at(1, 6),
      at(6, 1),
      at(2, 6),
      at(6, 2),
      at(3, 6),
      at(7, 2),
      at(5, 3),
    ])
    expect(analysis.certainty).toBe('tactical')
    expect(analysis.moves.at(-1)).toMatchObject({ rank: 'mistake', better: [{ x: 4, y: 6 }] })
    for (const { x, y } of analysis.moves.flatMap(({ better }) => better)) {
      expect(hasCell(config, x, y)).toBe(true)
    }
  })
})
