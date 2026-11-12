import type { Meta, StoryObj } from '@storybook/react-vite'
import type { HouseState } from '../../shared/house-protocol.ts'
import { Lost } from '../online/RoomPage.tsx'
import { Screen } from '../styleguide/Screen.tsx'
import { HouseEnter, HouseView } from './HousePage.tsx'

/**
 * A house (issue #95): who you are before you come in, and the house from the inside, with who is
 * there, the numbers after names that people share, and the shapes the others have. Use the
 * toolbar's Thema, Licht of donker and Taal, and a phone's viewport, to see it in every look and
 * language.
 */
const meta = {
  title: 'Onderdelen/Huis',
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

const nothing = () => undefined

const family: HouseState = {
  type: 'state',
  code: '482915',
  you: 'a',
  members: [
    { id: 'a', name: 'Anna', shape: 'heart', status: 'free' },
    { id: 'b', name: 'Opa', shape: 'fort', status: 'free' },
    { id: 'c', name: 'Anna', number: 2, shape: 'star', status: 'playing' },
    { id: 'd', name: 'Bas', status: 'watching' },
  ],
}

/** Before coming in: the name of last time is filled in. */
export const WhoAreYou: Story = {
  name: 'Wie ben je?',
  render: () => <HouseEnter code="482915" onEnter={nothing} />,
}

/** The first one in the house, waiting for the others. */
export const Alone: Story = {
  name: 'Alleen in het huis',
  render: () => (
    <HouseView
      state={{ ...family, members: [{ id: 'a', name: 'Anna', status: 'free' }] }}
      send={nothing}
    />
  ),
}

/** Four people, two of them called Anna, one still choosing a shape. */
export const Family: Story = {
  name: 'De familie is er',
  render: () => <HouseView state={family} send={nothing} />,
}

/** The shape somebody tried was taken by somebody else just before. */
export const ShapeTaken: Story = {
  name: 'Vorm al bezet',
  render: () => <HouseView state={family} send={nothing} problem="shape-taken" />,
}

/** The connection is gone for a moment: the house stays, with the banner above it. */
export const ConnectionLost: Story = {
  name: 'Verbinding weg',
  render: () => (
    <HouseView state={family} send={nothing} banner={<Lost onRetry={nothing} connecting />} />
  ),
}
