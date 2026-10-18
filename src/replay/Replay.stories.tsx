import type { Meta, StoryObj } from '@storybook/react-vite'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { Screen } from '../styleguide/Screen.tsx'
import '../play/Game.css'
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
