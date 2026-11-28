import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useRef } from 'react'
import { Screen } from '../styleguide/Screen.tsx'
import { ComputerGame } from './ComputerGame.tsx'
import type { Thinker } from './think.ts'
import { thinkOffThread } from './think.ts'

/**
 * Playing against the computer (issue #52): the choices, and the game in the states that only
 * this game has. The stories that show a game press the buttons the way a player does.
 */
const meta = {
  title: 'Onderdelen/Tegen de computer',
  component: ComputerGame,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Screen>
        <Story />
      </Screen>
    ),
  ],
} satisfies Meta<typeof ComputerGame>

export default meta
type Story = StoryObj<typeof meta>

/** The start: the classic field, where there is no character to choose. */
export const Choices: Story = { name: 'De keuzes' }

/** Presses the buttons one after the other, each when it is there. */
function Pressing({ buttons, think }: { buttons: readonly string[]; think: Thinker }) {
  const wrapper = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let next = 0
    const timer = setInterval(() => {
      const wanted = buttons[next]
      if (wanted === undefined) {
        clearInterval(timer)
        return
      }
      const found = [...(wrapper.current?.querySelectorAll('button') ?? [])].find((button) =>
        (button.getAttribute('aria-label') ?? button.textContent).startsWith(wanted),
      )
      // A cell that can't be played yet is tried again.
      if (!found || found.getAttribute('aria-disabled') === 'true') return
      found.click()
      next++
    }, 50)
    return () => {
      clearInterval(timer)
    }
  }, [buttons])
  return (
    <div ref={wrapper}>
      <ComputerGame think={think} />
    </div>
  )
}

const bigger = ['Groter']

/** On a bigger field the computer gets a character too. */
export const Characters: Story = {
  name: 'Een karakter kiezen',
  render: () => <Pressing buttons={bigger} think={thinkOffThread} />,
}

const first = ['Groter', 'Moeilijk', 'Wildebras', 'Start', 'Rij 4, kolom 4']
/** Never answers, so that the screen stays as it is while the computer thinks. */
const forever: Thinker = () => new Promise(() => undefined)

export const Thinking: Story = {
  name: 'De computer denkt na',
  render: () => <Pressing buttons={first} think={forever} />,
}

/** Its move is on the board and it is your turn again. */
export const Answered: Story = {
  name: 'Jij bent weer',
  render: () => <Pressing buttons={first} think={thinkOffThread} />,
}

const losing = ['Computer', 'Start', 'Rij 2, kolom 1', 'Rij 3, kolom 3']

/** The computer takes the top row. */
function topRow(): Thinker {
  return (game) =>
    Promise.resolve({ x: game.moves.filter(({ player }) => player === 'circle').length, y: 0 })
}

const fromTheTop = topRow()

export const Lost: Story = {
  name: 'De computer wint',
  render: () => <Pressing buttons={losing} think={fromTheTop} />,
}
