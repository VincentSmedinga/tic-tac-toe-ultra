import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CLASSIC_FIELD, OUTLINE_FIELDS } from '../../shared/room.ts'
import { Screen } from '../styleguide/Screen.tsx'
import { FieldPicker } from './FieldPicker.tsx'

const meta = {
  title: 'Onderdelen/Veldkiezer',
  component: FieldPicker,
  args: { value: CLASSIC_FIELD, onChange: () => undefined },
  decorators: [
    (Story) => (
      <Screen>
        <Story />
      </Screen>
    ),
  ],
  render: function Render(args) {
    const [value, setValue] = useState(args.value)
    return <FieldPicker value={value} onChange={setValue} />
  },
} satisfies Meta<typeof FieldPicker>

export default meta
type Story = StoryObj<typeof meta>

/** The ready-made fields, the classic one chosen, and a field of your own. */
export const Classic: Story = { name: 'Klassiek' }

/** A field that is not a rectangle: it has a name and one size. */
export const Pyramid: Story = { name: 'Piramide', args: { value: OUTLINE_FIELDS.pyramid } }

/** Your own field, with its lists. */
export const Own: Story = {
  name: 'Eigen veld',
  args: { value: { width: 9, height: 5, winLength: 4 } },
}
