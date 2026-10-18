import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { SHAPES } from '../shapes/shapes.ts'
import './StyleGuide.css'

const meta = {
  title: 'Basis/Vormen',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** All twelve shapes, large and at the smallest sizes they are used at, with the marker each was drawn with. */
export const Gallery: Story = {
  render: () => (
    <section className="guide" aria-labelledby="gallery-title">
      <h2 id="gallery-title">Alle vormen</h2>
      <p className="guide-note">
        Naast elkaar, zoals ze op het bord staan, en daarna elk groot en klein.
      </p>
      <div className="guide-row" aria-hidden="true">
        {SHAPES.map(({ id }) => (
          <ShapeIcon key={id} shape={id} size={36} decorative />
        ))}
      </div>
      <div className="guide-shapes">
        {SHAPES.map(({ id, name, marker }) => (
          <figure key={id}>
            <ShapeIcon shape={id} size={80} />
            <div className="guide-shape-sizes">
              <ShapeIcon shape={id} size={32} decorative />
              <ShapeIcon shape={id} size={20} decorative />
            </div>
            <figcaption>
              {name}
              <small>{marker}</small>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  ),
}

/** Every pair of shapes that can play against each other: twelve shapes make 66 pairs. */
export const Pairs: Story = {
  render: () => {
    const pairs = SHAPES.flatMap((first, index) =>
      SHAPES.slice(index + 1).map((second) => [first, second] as const),
    )
    return (
      <section className="guide" aria-labelledby="pairs-title">
        <h2 id="pairs-title">Alle paren die tegen elkaar kunnen spelen</h2>
        <p className="guide-note">{pairs.length.toString()} paren.</p>
        <ul className="guide-pairs">
          {pairs.map(([first, second]) => (
            <li
              key={`${first.id}-${second.id}`}
              className="guide-pair"
              aria-label={`${first.name} tegen ${second.name}`}
            >
              <ShapeIcon shape={first.id} size={28} decorative />
              <ShapeIcon shape={second.id} size={28} decorative />
            </li>
          ))}
        </ul>
      </section>
    )
  },
}
