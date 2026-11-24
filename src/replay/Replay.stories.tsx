import type { Meta, StoryObj } from '@storybook/react-vite'
import { analyseGame } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { Screen } from '../styleguide/Screen.tsx'
import '../play/Game.css'
import type { Analyser } from './analyse.ts'
import { Replay } from './Replay.tsx'

const meta = {
  title: 'Onderdelen/Terugkijken',
  component: Replay,
  decorators: [
    (Story) => (
      <Screen>
        <Story />
      </Screen>
    ),
  ],
} satisfies Meta<typeof Replay>

export default meta
type Story = StoryObj<typeof meta>

const config: GameConfig = { width: 3, height: 3, winLength: 3, players: ['cross', 'circle'] }

const at = (player: string, x: number, y: number): Move => ({ player, x, y })

/** A game that ends in a win: the buttons, the slider, the arrow keys and the autoplay. */
export const Won: Story = {
  name: 'Gewonnen spel',
  args: {
    config,
    moves: [
      at('cross', 0, 0),
      at('circle', 0, 1),
      at('cross', 1, 1),
      at('circle', 2, 1),
      at('cross', 2, 2),
    ],
    players: [
      { id: 'cross', name: 'Anna' },
      { id: 'circle', name: 'Ben' },
    ],
  },
}

export const Draw: Story = {
  name: 'Gelijkspel',
  args: {
    config,
    moves: [
      at('cross', 0, 0),
      at('circle', 1, 1),
      at('cross', 2, 2),
      at('circle', 1, 0),
      at('cross', 1, 2),
      at('circle', 0, 2),
      at('cross', 2, 0),
      at('circle', 2, 1),
      at('cross', 0, 1),
    ],
  },
}

/** Three players on a bigger field, which the replay handles like any other. */
export const ThreePlayers: Story = {
  name: 'Drie spelers',
  args: {
    config: { width: 7, height: 7, winLength: 4, players: ['cross', 'circle', 'heart'] },
    moves: [
      at('cross', 3, 3),
      at('circle', 2, 2),
      at('heart', 4, 4),
      at('cross', 3, 2),
      at('circle', 4, 3),
      at('heart', 2, 4),
    ],
  },
}

/** The real analysis, there at once: a story shows the ranks, not the waiting for a worker. */
const analyse: Analyser = (game, moves) => Promise.resolve(analyseGame(game, moves))

/**
 * A 3 × 3 game with every rank in it. The moves that were judged are marked on the line under the
 * slider and in the list, and a mistake shows the cell that was better with a dashed ring. Step to
 * move 2 or 3 to see it.
 */
export const Ranked: Story = {
  name: 'Zetten beoordeeld',
  args: {
    config,
    analyse,
    moves: [
      at('cross', 0, 0),
      at('circle', 1, 0),
      at('cross', 2, 0),
      at('circle', 1, 2),
      at('cross', 1, 1),
      at('circle', 2, 2),
      at('cross', 0, 2),
    ],
    players: [
      { id: 'cross', name: 'Anna' },
      { id: 'circle', name: 'Ben' },
    ],
  },
}

/** The same game opened on its summary, as "Bekijk samenvatting" does at the end of a game. */
export const Summary: Story = {
  name: 'Samenvatting',
  args: { ...Ranked.args, startAtSummary: true },
}

/**
 * Three players on a bigger field: nothing can be solved there, so only the clear moves are judged
 * (marked "minder zeker") and the summary says so and gives no accuracy.
 */
export const RankedThreePlayers: Story = {
  name: 'Samenvatting met drie spelers',
  args: {
    config: { width: 6, height: 6, winLength: 3, players: ['cross', 'circle', 'heart'] },
    analyse,
    startAtSummary: true,
    moves: [
      at('cross', 0, 0),
      at('circle', 0, 5),
      at('heart', 1, 5),
      at('cross', 1, 0),
      at('circle', 2, 5),
      at('heart', 3, 5),
      at('cross', 2, 3),
    ],
  },
}

/** While the moves are being judged: the replay works, and the summary comes when it is there. */
export const Judging: Story = {
  name: 'Zetten beoordelen',
  args: {
    ...Ranked.args,
    analyse: () => new Promise(() => undefined),
  },
}
