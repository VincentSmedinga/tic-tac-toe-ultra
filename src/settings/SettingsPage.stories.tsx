import type { Meta, StoryObj } from '@storybook/react-vite'
import { useGlobals } from 'storybook/preview-api'
import { Screen } from '../styleguide/Screen.tsx'
import { SettingsPage } from './SettingsPage.tsx'

const meta = {
  title: 'Onderdelen/Instellingen',
  component: SettingsPage,
  parameters: { layout: 'fullscreen' },
  // The page reads the look, light or dark and the language when it is shown, and what it changes
  // itself the toolbar follows (see .storybook/preview.tsx).
  render: function Render() {
    const [{ look, scheme, language }] = useGlobals()
    return (
      <Screen>
        <SettingsPage key={`${String(look)}-${String(scheme)}-${String(language)}`} />
      </Screen>
    )
  },
} satisfies Meta<typeof SettingsPage>

export default meta
type Story = StoryObj<typeof meta>

/** How the game looks, the language, the name and what the game is. */
export const Settings: Story = { name: 'Instellingen' }
