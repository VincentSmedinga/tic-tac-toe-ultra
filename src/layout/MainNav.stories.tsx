import type { Meta, StoryObj } from '@storybook/react-vite'
import { useGlobals } from 'storybook/preview-api'
import { Screen } from '../styleguide/Screen.tsx'
import { MainNav } from './MainNav.tsx'

const meta = {
  title: 'Onderdelen/Hoofdmenu',
  component: MainNav,
  parameters: { layout: 'fullscreen' },
  // The menu reads the language when it is shown, so it starts afresh when the toolbar changes it.
  // Below 48 rem (the phone in the viewport toolbar) it is the bar of tabs, from 48 rem a row.
  render: function Render(args) {
    const [{ language }] = useGlobals()
    return (
      <Screen>
        <MainNav key={String(language)} {...args} />
      </Screen>
    )
  },
} satisfies Meta<typeof MainNav>

export default meta
type Story = StoryObj<typeof meta>

/** The place you are in is marked: here the start. */
export const OnTheStartScreen: Story = {
  name: 'Op het beginscherm',
  args: { route: { name: 'start' } },
}

export const OnTheSettings: Story = {
  name: 'Op de instellingen',
  args: { route: { name: 'settings' } },
}

/** A game that is being played has no place of its own: no tab is marked. (On a phone the bar is left out there.) */
export const WhilePlaying: Story = {
  name: 'Tijdens het spel',
  args: { route: { name: 'local' } },
}
