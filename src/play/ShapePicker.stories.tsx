import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { ShapeId } from '../shapes/shapes.ts'
import { Screen } from '../styleguide/Screen.tsx'
import { ShapePicker } from './ShapePicker.tsx'

const meta = {
  title: 'Onderdelen/Vormenkiezer',
  component: ShapePicker,
  args: { label: 'Speler 1', value: null, onChange: () => undefined },
  decorators: [
    (Story) => (
      <Screen>
        <Story />
      </Screen>
    ),
  ],
} satisfies Meta<typeof ShapePicker>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing chosen yet. */
export const Nothing: Story = { name: 'Nog niets gekozen' }

/** One tap picks: this one really picks. */
export const Choosing: Story = {
  name: 'Kiezen',
  render: function Render(args) {
    const [value, setValue] = useState<ShapeId | null>('cross')
    return <ShapePicker {...args} value={value} onChange={setValue} />
  },
}

/** The shapes somebody else has can't be picked, and say by whom. */
export const Taken: Story = {
  name: 'Een deel is bezet',
  args: {
    label: 'Speler 3',
    value: 'heart',
    taken: { cross: 'Anna', circle: 'Ben', star: 'Cas' },
  },
}
