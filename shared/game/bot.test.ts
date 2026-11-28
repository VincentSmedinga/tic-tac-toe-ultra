import { describe, expect, it } from 'vitest'
import { Solver } from './analysis.ts'
import { BOT_CHARACTERS } from './bot-value.ts'
import type { BotCharacter } from './bot-value.ts'
import { BOT_LEVELS, chooseMove } from './bot.ts'
import type { Bot, BotLevel, Random } from './bot.ts'
import { applyMove, createGame } from './game.ts'
import type { Cell, GameConfig, GameState, PlayerId } from './game.ts'
import { OUTLINES } from './outline.ts'

/** The same numbers for the same seed (mulberry32). */
function seeded(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Always the first choice: no chance in it. */
const first: Random = () => 0

const PLAYERS = 'abcdefghijkl'.split('')

/** The time a test that plays whole games gets: CI is several times slower than a laptop. */
const WHOLE_GAMES = 30_000

function field(size: number, winLength: number, players = 2): GameConfig {
  return { width: size, height: size, winLength, players: PLAYERS.slice(0, players) }
}

function play(state: GameState, { x, y }: Cell): GameState {
  if (state.status.kind !== 'playing') throw new Error('the game is over')
  const result = applyMove(state, { player: state.status.next, x, y })
  if (!result.ok) throw new Error(`${result.error} at ${x.toString()},${y.toString()}`)
  return result.state
}

/** The position after each player's marks were put in turn, the first player starting. */
function position(config: GameConfig, ...marks: [number, number][][]): GameState {
  let state = createGame(config)
  const rounds = Math.max(...marks.map((own) => own.length))
  for (let round = 0; round < rounds; round++) {
    for (const own of marks) {
      const mark = own[round]
      if (mark) state = play(state, { x: mark[0], y: mark[1] })
    }
  }
  return state
}

function choose(state: GameState, bot: Bot, random: Random = first): Cell {
  if (state.status.kind !== 'playing') throw new Error('the game is over')
  const cell = chooseMove(state, state.status.next, bot, random)
  if (!cell) throw new Error('no move')
  return cell
}

/** A whole game between computers, at most `limit` moves of it. */
function game(config: GameConfig, bots: Bot[], random: Random, limit = 1000): GameState {
  let state = createGame(config)
  const solver = new Solver(config, 0)
  while (state.status.kind === 'playing' && state.moveCount < limit) {
    const player: PlayerId = state.status.next
    const bot = bots[config.players.indexOf(player) % bots.length]
    if (!bot) throw new Error('no computer for this player')
    const cell = chooseMove(state, player, bot, random, { solver })
    if (!cell) throw new Error('no move')
    // `play` throws on a move the engine refuses.
    state = play(state, cell)
  }
  return state
}

const everyBot: Bot[] = BOT_LEVELS.flatMap((level) =>
  BOT_CHARACTERS.map((character) => ({ level, character })),
)
/** The levels that never miss a win, with every character. */
const watchful = everyBot.filter(({ level }) => level !== 'easy')

describe('the computer player', () => {
  const fields: [string, GameConfig, number][] = [
    ['3 × 3', field(3, 3), 9],
    ['5 × 5, four in a row', field(5, 4), 25],
    ['7 × 7 with three players', field(7, 5, 3), 49],
    ['a narrow 3 × 9', { width: 3, height: 9, winLength: 4, players: ['a', 'b'] }, 27],
    [
      'the pyramid',
      { ...OUTLINES.pyramid, winLength: 5, players: ['a', 'b'], outline: 'pyramid' },
      20,
    ],
    ['the plus', { ...OUTLINES.plus, winLength: 5, players: ['a', 'b'], outline: 'plus' }, 20],
    ['19 × 19', field(19, 5), 24],
    ['19 × 19 with twelve players, nine in a row', field(19, 9, 12), 40],
  ]

  it.each(fields)(
    'only plays moves the engine accepts: %s',
    (_, config, limit) => {
      const { width, height, winLength, players, outline } = config
      const clean = { width, height, winLength, players, ...(outline ? { outline } : {}) }
      for (const [index, bot] of everyBot.entries()) {
        expect(() => game(clean, [bot], seeded(index), limit)).not.toThrow()
      }
    },
    WHOLE_GAMES,
  )

  it('has no move when it is not that player’s turn, or the game is over', () => {
    const start = createGame(field(3, 3))
    const bot: Bot = { level: 'hard', character: 'balanced' }
    expect(chooseMove(start, 'b', bot, first)).toBeNull()
    const won = position(
      field(3, 3),
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 1],
        [1, 1],
      ],
    )
    expect(won.status.kind).toBe('won')
    expect(chooseMove(won, 'b', bot, first)).toBeNull()
  })

  it('does not change the position it is given', () => {
    const state = position(field(9, 5), [[4, 4]], [[3, 3]])
    const before = structuredClone(state)
    for (const bot of everyBot) choose(state, bot, seeded(1))
    expect(state).toEqual(before)
  })

  it.each(BOT_LEVELS)(
    'plays the same game with the same random numbers: %s',
    (level) => {
      const bots: Bot[] = [
        { level, character: 'attacker' },
        { level, character: 'wild' },
      ]
      const once = game(field(11, 5), bots, seeded(42))
      expect(game(field(11, 5), bots, seeded(42)).moves).toEqual(once.moves)
      expect(game(field(11, 5), bots, seeded(43)).moves).not.toEqual(once.moves)
    },
    WHOLE_GAMES,
  )

  describe('a win in one move', () => {
    // `a` has four in a row with one end open, `b` has four too: `a` is to move.
    const both = position(
      field(9, 5),
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ],
      [
        [0, 5],
        [1, 5],
        [2, 5],
        [3, 5],
      ],
    )

    it('is taken, rather than blocking somebody else’s', () => {
      for (const bot of watchful) {
        for (let seed = 0; seed < 10; seed++) {
          expect(choose(both, bot, seeded(seed))).toEqual({ x: 4, y: 0 })
        }
      }
    })

    it('is blocked when the next player has it', () => {
      const state = position(
        field(9, 5),
        [
          [8, 8],
          [8, 6],
          [6, 8],
          [6, 6],
        ],
        [
          [0, 5],
          [1, 5],
          [2, 5],
          [3, 5],
        ],
      )
      for (const bot of watchful) {
        for (let seed = 0; seed < 10; seed++) {
          expect(choose(state, bot, seeded(seed))).toEqual({ x: 4, y: 5 })
        }
      }
    })

    it('is blocked when a later player has it and nobody before them does', () => {
      const three = position(
        field(9, 5, 3),
        [
          [8, 8],
          [8, 6],
          [6, 8],
          [6, 6],
        ],
        [
          [8, 1],
          [6, 2],
          [4, 1],
          [2, 2],
        ],
        [
          [0, 5],
          [1, 5],
          [2, 5],
          [3, 5],
        ],
      )
      for (const bot of watchful) expect(choose(three, bot)).toEqual({ x: 4, y: 5 })
    })

    it('is sometimes missed by the easy level, and mostly seen', () => {
      let taken = 0
      for (let seed = 0; seed < 200; seed++) {
        const cell = choose(both, { level: 'easy', character: 'balanced' }, seeded(seed))
        if (cell.x === 4 && cell.y === 0) taken++
      }
      expect(taken).toBeGreaterThan(140)
      expect(taken).toBeLessThan(195)
    })
  })

  describe('the hard level on 3 × 3', () => {
    it.each(BOT_CHARACTERS)(
      'never loses, whatever the other player does: %s',
      (character) => {
        const config = field(3, 3)
        const solver = new Solver(config, 0)
        const random = seeded(7)
        for (const bot of ['a', 'b']) {
          let games = 0
          let lost = 0
          const walk = (state: GameState) => {
            if (state.status.kind !== 'playing') {
              games++
              if (state.status.kind === 'won' && state.status.winner !== bot) lost++
              return
            }
            if (state.status.next === bot) {
              const cell = chooseMove(state, bot, { level: 'hard', character }, random, { solver })
              if (!cell) throw new Error('no move')
              walk(play(state, cell))
              return
            }
            for (const [index, mark] of state.cells.entries()) {
              if (mark === null) walk(play(state, { x: index % 3, y: Math.floor(index / 3) }))
            }
          }
          walk(createGame(config))
          expect(games).toBeGreaterThan(0)
          expect(lost).toBe(0)
        }
      },
      30_000,
    )
  })

  it('answers quickly on the biggest field', () => {
    const half = game(field(19, 5), [{ level: 'medium', character: 'defender' }], seeded(3), 60)
    expect(half.status.kind).toBe('playing')
    const started = performance.now()
    for (const character of BOT_CHARACTERS) choose(half, { level: 'hard', character }, seeded(1))
    // Each takes well under half a second; the margin is for a busy computer.
    expect((performance.now() - started) / BOT_CHARACTERS.length).toBeLessThan(2000)
  })

  describe('the levels', () => {
    /** Games on 9 × 9, five in a row, each starting in turn: how often each side wins. */
    function match(a: Bot, b: Bot, games: number): { a: number; b: number } {
      const wins = { a: 0, b: 0 }
      for (let index = 0; index < games; index++) {
        const aStarts = index % 2 === 0
        const end = game(field(9, 5), aStarts ? [a, b] : [b, a], seeded(100 + index))
        if (end.status.kind !== 'won') continue
        wins[(end.status.winner === 'a') === aStarts ? 'a' : 'b']++
      }
      return wins
    }
    const bot = (level: BotLevel, character: BotCharacter): Bot => ({ level, character })

    it.each(BOT_CHARACTERS)(
      'are in order of strength with every character: %s',
      (character) => {
        const middle = match(bot('medium', character), bot('easy', character), 12)
        expect(middle.a).toBeGreaterThan(middle.b + 4)
        const top = match(bot('hard', character), bot('medium', character), 12)
        expect(top.a).toBeGreaterThan(top.b)
      },
      60_000,
    )
  })

  describe('the characters', () => {
    const pick = (state: GameState, character: BotCharacter) =>
      choose(state, { level: 'medium', character })
    const touches = (state: GameState, { x, y }: Cell, player: PlayerId): number =>
      state.cells.filter(
        (mark, index) =>
          mark === player &&
          Math.abs((index % state.config.width) - x) <= 1 &&
          Math.abs(Math.floor(index / state.config.width) - y) <= 1,
      ).length

    // Both have two in a row, far apart, and `a` is to move.
    const twos = position(
      field(11, 5),
      [
        [2, 2],
        [3, 2],
      ],
      [
        [7, 8],
        [8, 8],
      ],
    )

    it('defender: goes to the other player’s line', () => {
      const cell = pick(twos, 'defender')
      expect(touches(twos, cell, 'b')).toBeGreaterThan(0)
      expect(touches(twos, cell, 'a')).toBe(0)
    })

    it('attacker: builds on its own line', () => {
      const cell = pick(twos, 'attacker')
      expect(touches(twos, cell, 'a')).toBeGreaterThan(0)
      expect(touches(twos, cell, 'b')).toBe(0)
    })

    // `a` has three with one end shut, `b` has three with both ends open.
    const threes = position(
      field(11, 5),
      [
        [1, 2],
        [2, 2],
        [3, 2],
        [10, 10],
      ],
      [
        [0, 2],
        [4, 8],
        [5, 8],
        [6, 8],
      ],
    )

    it('balanced: stops an open row of three', () => {
      expect([3, 7]).toContain(pick(threes, 'balanced').x)
      expect(pick(threes, 'balanced').y).toBe(8)
    })

    it('wild: threatens to win instead', () => {
      const cell = pick(threes, 'wild')
      expect(cell.y).toBe(2)
      expect([4, 5]).toContain(cell.x)
    })

    it('wild: stays right next to the others, where the attacker keeps to itself', () => {
      const apart = position(field(11, 5), [[2, 2]], [[7, 7]])
      expect(touches(apart, pick(apart, 'attacker'), 'b')).toBe(0)
      const close = position(
        field(11, 5),
        [
          [5, 5],
          [1, 9],
        ],
        [
          [7, 5],
          [7, 6],
        ],
      )
      expect(touches(close, pick(close, 'wild'), 'b')).toBeGreaterThan(0)
    })
  })
})
