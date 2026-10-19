import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef } from 'react'
import type { Move } from '../../shared/game/index.ts'
import type { StateMessage } from '../../shared/protocol.ts'
import { roomConfig } from '../../shared/room.ts'
import { Screen } from '../styleguide/Screen.tsx'
import { OnlineGame } from './OnlineGame.tsx'
import type { StartedState } from './started.ts'

/**
 * The end of a game in a room (issue #88): "Nog een keer", "Kijk terug" and "Stoppen", the question
 * that comes before leaving, and what is left of the room when people have left. Use the toolbar's
 * Thema, Licht of donker and Taal, and a phone's viewport, to see it in every look and language.
 */
const meta = {
  title: 'Onderdelen/Einde van een spel',
  parameters: { layout: 'padded' },
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

const SHAPES = ['cross', 'circle', 'star'] as const

/** The cross wins on the top row. */
const won: Move[] = [
  { player: 'cross', x: 0, y: 0 },
  { player: 'circle', x: 0, y: 1 },
  { player: 'cross', x: 1, y: 0 },
  { player: 'circle', x: 1, y: 1 },
  { player: 'cross', x: 2, y: 0 },
]

/** A room of two or three, as the cross sees it, with `left` of them gone. */
function room(seats: 2 | 3, left: number): StartedState {
  const shapes = SHAPES.slice(0, seats)
  const config = roomConfig(0, shapes)
  const players: StateMessage['players'] = shapes.map((shape, index) => ({
    id: index === 0 ? 'X' : index === 1 ? 'O' : '3',
    shape,
    ...(index === 0 ? { name: 'Anna' } : {}),
    connected: true,
    ...(index >= seats - left && index > 0 ? { left: true } : {}),
  }))
  return {
    type: 'state',
    code: 'BCDF',
    you: 'X',
    field: { width: 3, height: 3, winLength: 3 },
    seats,
    round: 0,
    players,
    config: { ...config, players: [...config.players] },
    moves: seats === 2 ? won : [],
  }
}

/** The game of a room; with `ask` it presses "Stoppen" at once, the way a player does. */
function Ended({ state, ask = false }: { state: StartedState; ask?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ask) return
    const buttons = wrapper.current?.querySelectorAll<HTMLButtonElement>('.game-actions button')
    buttons?.[buttons.length - 1]?.click()
  }, [ask])
  return (
    <div ref={wrapper}>
      <OnlineGame state={state} send={() => undefined} />
    </div>
  )
}

/** The round is won: a rematch, the replay and a quiet way out. */
export const Stoppen: Story = {
  render: () => <Ended state={room(2, 0)} />,
}

/** Leaving is for good, so there is a question first, with the answer that stays in focus. */
export const Question: Story = {
  name: 'De vraag',
  render: () => <Ended state={room(2, 0)} ask />,
}

/** The other player has left: no rematch, only the replay and the way out. */
export const SomeoneLeft: Story = {
  name: 'Een speler weg',
  render: () => <Ended state={room(2, 1)} />,
}
