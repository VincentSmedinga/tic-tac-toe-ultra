import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef } from 'react'
import type { Move } from '../../shared/game/index.ts'
import type { StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { OnlineGame } from '../online/OnlineGame.tsx'
import type { StartedState } from '../online/started.ts'
import { Screen } from '../styleguide/Screen.tsx'

/**
 * The play mode (issue #55): the board, who is to play, the players and the way out over the whole
 * screen. The stories that show it on start by pressing the button, the way a player does; use the
 * toolbar's Thema and Licht of donker, and the viewport of Storybook for a phone, a tablet and a
 * phone that is turned, to see it in every look and shape.
 */
const meta = {
  title: 'Onderdelen/Volledig scherm',
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Screen>
        <Story />
      </Screen>
    ),
  ],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const SHAPES = ['cross', 'circle', 'heart', 'star'] as const

/** A room of `seats` players on a field of `size` × `size`, with the moves that were played. */
function room(size: number, winLength: number, seats: 2 | 3 | 4, moves: Move[] = []): StartedState {
  const shapes = SHAPES.slice(0, seats)
  const config = roomConfig(0, shapes, { width: size, height: size, winLength })
  const players: StateMessage['players'] = shapes.map((shape, index) => ({
    id: index === 0 ? 'X' : index === 1 ? 'O' : String(index + 1),
    shape,
    ...(index === 0 ? { name: 'Anna' } : {}),
    connected: true,
  }))
  return {
    type: 'state',
    code: 'BCDF',
    you: 'O',
    field: { width: size, height: size, winLength },
    seats,
    round: 0,
    players,
    config: { ...config, players: [...config.players] },
    moves,
  }
}

/** The game of a room, with its mode switched on at once, as after a press on the button. */
function Playing({ state, open }: { state: StartedState; open: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) wrapper.current?.querySelector<HTMLButtonElement>('.play-mode-button')?.click()
  }, [open])
  return (
    <div ref={wrapper}>
      <OnlineGame state={state} send={() => undefined} />
    </div>
  )
}

const some: Move[] = [
  { player: 'cross', x: 1, y: 1 },
  { player: 'circle', x: 0, y: 0 },
  { player: 'cross', x: 2, y: 1 },
]

const four: Move[] = [
  { player: 'cross', x: 9, y: 9 },
  { player: 'circle', x: 8, y: 8 },
  { player: 'heart', x: 10, y: 10 },
  { player: 'star', x: 9, y: 8 },
  { player: 'cross', x: 8, y: 9 },
]

/** Before the mode: the button sits next to the field, where a player finds it. */
export const Button: Story = {
  name: 'De knop',
  render: () => <Playing state={room(3, 3, 2, some)} open={false} />,
}

/** In the mode, on a field that fits: the board takes all the room, as big as it can be. */
export const Open: Story = {
  name: 'Aan',
  render: () => <Playing state={room(3, 3, 2, some)} open />,
}

/** A field that does not fit in the cells' minimum size is scrolled inside its frame; the page never scrolls. */
export const BigField: Story = {
  name: 'Groot veld',
  render: () => <Playing state={room(19, 5, 4, four)} open />,
}
