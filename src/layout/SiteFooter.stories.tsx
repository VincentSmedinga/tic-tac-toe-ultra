import type { Meta, StoryObj } from '@storybook/react-vite'
import { useGlobals } from 'storybook/preview-api'
import { Screen } from '../styleguide/Screen.tsx'
import { SiteFooter } from './SiteFooter.tsx'

const meta = {
  title: 'Onderdelen/Voet',
  component: SiteFooter,
  parameters: { layout: 'fullscreen' },
  // The footer reads the look, light or dark and the language when it is shown, so it starts afresh when the
  // toolbar changes them; and what it changes itself, the toolbar follows (see .storybook/preview.tsx).
  render: function Render(args) {
    const [{ look, scheme, language }] = useGlobals()
    return (
      <Screen>
        <SiteFooter key={`${String(look)}-${String(scheme)}-${String(language)}`} {...args} />
      </Screen>
    )
  },
} satisfies Meta<typeof SiteFooter>

export default meta
type Story = StoryObj<typeof meta>

/** The links between the screens and the two choices about how the game looks. */
export const OnTheGame: Story = {
  name: 'Bij het spel',
  args: { route: { name: 'local' } },
}

export const OnTheStartScreen: Story = {
  name: 'Op het beginscherm',
  args: { route: { name: 'start' } },
}
