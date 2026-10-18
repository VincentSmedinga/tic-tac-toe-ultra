/**
 * The game engine: noughts and crosses on a `width` × `height` field, for any number of players,
 * where `winLength` marks in a row win. Pure and immutable, no browser or Node APIs, so the app and
 * the server run exactly the same rules. Classic tic-tac-toe is `{ width: 3, height: 3,
 * winLength: 3, players: ['X', 'O'] }`.
 */

/** Who plays: the engine only knows this id; which shape a player gets is up to the app. */
export type PlayerId = string

export interface GameConfig {
  readonly width: number
  readonly height: number
  /** How many marks in a row win. */
  readonly winLength: number
  /** The players, in turn order: the first one starts. */
  readonly players: readonly PlayerId[]
}

/** A cell of the field: `x` counts columns and `y` rows, both from 0 at the top left. */
export interface Cell {
  readonly x: number
  readonly y: number
}

export interface Move extends Cell {
  readonly player: PlayerId
}

export type GameStatus =
  | { readonly kind: 'playing'; readonly next: PlayerId }
  /** `line` is the whole unbroken run through the last move, so at least `winLength` cells. */
  | { readonly kind: 'won'; readonly winner: PlayerId; readonly line: readonly Cell[] }
  | { readonly kind: 'draw' }

export interface GameState {
  readonly config: GameConfig
  /** Row by row: the cell at (x, y) is `cells[y * width + x]`; null while empty. */
  readonly cells: readonly (PlayerId | null)[]
  /** Every move played, in order: with `config` this is the whole game, and enough to replay it. */
  readonly moves: readonly Move[]
  readonly moveCount: number
  readonly status: GameStatus
}

export type MoveError = 'game-over' | 'not-your-turn' | 'out-of-bounds' | 'cell-taken'

export type MoveResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly error: MoveError }

/** Right, down, down-right and down-left: each is a line through a cell, together with its opposite. */
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const

/** Starts a game on an empty field. Throws a `RangeError` when the config can't make a game. */
export function createGame(config: GameConfig): GameState {
  const { width, height, winLength, players } = config
  if (!Number.isInteger(width) || width < 1)
    throw new RangeError('width must be a whole number of at least 1')
  if (!Number.isInteger(height) || height < 1)
    throw new RangeError('height must be a whole number of at least 1')
  if (!Number.isInteger(winLength) || winLength < 2)
    throw new RangeError('winLength must be a whole number of at least 2')
  if (winLength > Math.max(width, height))
    throw new RangeError('winLength does not fit on the field, so nobody could win')
  if (players.length < 2) throw new RangeError('a game needs at least two players')
  if (new Set(players).size !== players.length) throw new RangeError('players must be different')

  const [first] = players
  if (first === undefined) throw new RangeError('a game needs at least two players')
  return {
    config: { width, height, winLength, players: [...players] },
    cells: new Array<PlayerId | null>(width * height).fill(null),
    moves: [],
    moveCount: 0,
    status: { kind: 'playing', next: first },
  }
}

/** The player on a cell, null when it is empty, undefined when the cell is off the field. */
export function getCell(state: GameState, { x, y }: Cell): PlayerId | null | undefined {
  if (!isOnField(state.config, x, y)) return undefined
  return state.cells[y * state.config.width + x]
}

/**
 * Plays a move and returns the new state; `state` itself is never changed. A move that breaks a
 * rule comes back as `{ ok: false, error }`, so the server can answer the player who sent it.
 */
export function applyMove(state: GameState, move: Move): MoveResult {
  const { config, status } = state
  if (status.kind !== 'playing') return fail('game-over')
  if (move.player !== status.next) return fail('not-your-turn')
  if (!isOnField(config, move.x, move.y)) return fail('out-of-bounds')
  if (getCell(state, move) !== null) return fail('cell-taken')

  const cells = state.cells.with(move.y * config.width + move.x, move.player)
  const moveCount = state.moveCount + 1
  // Keep only what the engine knows about a move, so extra properties of what a caller passes in
  // (a message from a client, say) never end up in a stored game.
  const moves = [...state.moves, { player: move.player, x: move.x, y: move.y }]
  const next: GameState = { config, cells, moves, moveCount, status }

  const line = findLine(next, move)
  if (line) return succeed({ ...next, status: { kind: 'won', winner: move.player, line } })
  if (moveCount === config.width * config.height)
    return succeed({ ...next, status: { kind: 'draw' } })

  const index = config.players.indexOf(move.player)
  const following = config.players[(index + 1) % config.players.length]
  if (following === undefined)
    throw new Error('unreachable: the player of a move is one of the players')
  return succeed({ ...next, status: { kind: 'playing', next: following } })
}

function fail(error: MoveError): MoveResult {
  return { ok: false, error }
}

function succeed(state: GameState): MoveResult {
  return { ok: true, state }
}

function isOnField({ width, height }: GameConfig, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < width && y >= 0 && y < height
}

/**
 * The winning line through the cell just played, if there is one. Only the four lines through that
 * cell can have become a win, so this costs the same on a huge field as on a small one.
 */
function findLine(state: GameState, { x, y, player }: Move): Cell[] | null {
  const ray = (dx: number, dy: number): Cell[] => {
    const cells: Cell[] = []
    for (
      let cell = { x: x + dx, y: y + dy };
      getCell(state, cell) === player;
      cell = { x: cell.x + dx, y: cell.y + dy }
    ) {
      cells.push(cell)
    }
    return cells
  }

  for (const [dx, dy] of DIRECTIONS) {
    const line = [...ray(-dx, -dy).reverse(), { x, y }, ...ray(dx, dy)]
    if (line.length >= state.config.winLength) return line
  }
  return null
}
