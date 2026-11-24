import type { Meta, StoryObj } from '@storybook/react-vite'
import type { HouseState } from '../../shared/house-protocol.ts'
import { Lost } from '../online/RoomPage.tsx'
import { Screen } from '../styleguide/Screen.tsx'
import { HouseEnter, HouseView } from './HousePage.tsx'

/**
 * A house (issues #95 and #96): who you are before you come in, and the house from the inside, with
 * who is there, the numbers after names that people share, the shapes the others have, starting a
 * game, an invitation and how the others invited with you answered. Use the
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

/** Opa invites Anna, Oma and Bas; Oma has said yes and Bas no. */
const invitation: NonNullable<HouseState['invitation']> = {
  from: 'b',
  field: { width: 7, height: 7, winLength: 5 },
  people: [
    { id: 'a', answer: 'open' },
    { id: 'e', answer: 'yes' },
    { id: 'd', answer: 'no' },
  ],
}

const invited: HouseState = {
  type: 'state',
  code: '482915',
  you: 'a',
  members: [
    { id: 'a', name: 'Anna', shape: 'heart', status: 'invited' },
    { id: 'b', name: 'Opa', shape: 'fort', status: 'inviting' },
    { id: 'e', name: 'Oma', shape: 'moon', status: 'invited' },
    { id: 'd', name: 'Bas', shape: 'bolt', status: 'free' },
    { id: 'c', name: 'Anna', number: 2, shape: 'star', status: 'playing' },
  ],
  invitation,
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

/** Somebody else has invited you: "Speel mee" or "Nee, dank je", and how the others answered. */
export const Invited: Story = {
  name: 'Uitgenodigd',
  render: () => <HouseView state={invited} send={nothing} />,
}

/** You said yes: waiting for the others, or for the minute to be over. */
export const Waiting: Story = {
  name: 'Wachten op de anderen',
  render: () => (
    <HouseView
      state={{
        ...invited,
        invitation: {
          ...invitation,
          people: invitation.people.map((person) =>
            person.id === 'a' ? { ...person, answer: 'yes' } : person,
          ),
        },
      }}
      send={nothing}
    />
  ),
}

/** You invited the others: those who haven't answered are "uitgenodigd". */
export const Inviting: Story = {
  name: 'Je nodigt uit',
  render: () => (
    <HouseView
      state={{
        ...invited,
        you: 'b',
      }}
      send={nothing}
    />
  ),
}

/** Back in the house during a game: the way back to it. */
export const Playing: Story = {
  name: 'Je speelt',
  render: () => (
    <HouseView
      state={{
        ...family,
        members: family.members.map((member) =>
          member.id === 'a' ? { ...member, status: 'playing' } : member,
        ),
        room: 'BCDF',
      }}
      send={nothing}
    />
  ),
}

/** Nobody said yes in time. */
export const InvitationOff: Story = {
  name: 'Uitnodiging vervallen',
  render: () => <HouseView state={family} send={nothing} problem="invitation-off" />,
}

/** Four people, two of them called Anna, one still choosing a shape; Anna can invite Opa. */
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
