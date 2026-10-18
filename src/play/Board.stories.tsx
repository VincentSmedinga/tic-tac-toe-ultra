import type { Meta, StoryObj } from '@storybook/react-vite'
import { applyMove, createGame } from '../../shared/game/index.ts'
import type { GameConfig, GameState } from '../../shared/game/index.ts'
import { Screen } from '../styleguide/Screen.tsx'
import { Board } from './Board.tsx'
import './Game.css'

const meta = {
  title: 'Onderdelen/Bord',
  component: Board,
  args: { onPlay: () => undefined },
  decorators: [
    (Story) => (
      <Screen>
        <div className="game">
          <Story />
        </div>
      </Screen>
    ),
  ],
} satisfies Meta<typeof Board>

export default meta
type Story = StoryObj<typeof meta>

const classic: GameConfig = {
  width: 3,
  height: 3,
  winLength: 3,
  players: ['cross', 'circle'],
}

/** Plays the moves, given as [x, y] and alternating between the players in turn order. */
function played(config: GameConfig, moves: readonly (readonly [number, number])[]): GameState {
  let state = createGame(config)
  for (const [x, y] of moves) {
    if (state.status.kind !== 'playing') throw new Error('the game is already over')
    const result = applyMove(state, { player: state.status.next, x, y })
    if (!result.ok) throw new Error(`move ${x.toString()},${y.toString()}: ${result.error}`)
    state = result.state
  }
  return state
}

export const Empty: Story = { args: { game: createGame(classic) } }

/** The cell played last is marked, as in the replay. */
export const AMove: Story = {
  name: 'Een zet',
  args: {
    game: played(classic, [
      [1, 1],
      [0, 0],
      [2, 1],
    ]),
    lastMove: { x: 2, y: 1 },
  },
}

/** A win: the whole line is marked. */
export const Won: Story = {
  name: 'Gewonnen',
  args: {
    game: played(classic, [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ]),
    lastMove: { x: 2, y: 2 },
  },
}

/** The last move closes a row and a column at once: a corner is marked on both lines. */
export const WonOnTwoLines: Story = {
  name: 'Gewonnen met twee lijnen',
  args: {
    game: played(classic, [
      [1, 0],
      [1, 1],
      [2, 0],
      [2, 1],
      [0, 1],
      [1, 2],
      [0, 2],
      [2, 2],
      [0, 0],
    ]),
    lastMove: { x: 0, y: 0 },
  },
}

export const Draw: Story = {
  name: 'Gelijkspel',
  args: {
    game: played(classic, [
      [0, 0],
      [1, 1],
      [2, 2],
      [1, 0],
      [1, 2],
      [0, 2],
      [2, 0],
      [2, 1],
      [0, 1],
    ]),
  },
}

/** A bigger field with more players, which is scrolled inside its frame when it does not fit. */
export const BigField: Story = {
  name: 'Groot veld, drie spelers',
  args: {
    game: played({ width: 9, height: 9, winLength: 5, players: ['cross', 'circle', 'heart'] }, [
      [4, 4],
      [3, 3],
      [5, 5],
      [4, 3],
    ]),
    lastMove: { x: 4, y: 3 },
  },
}
