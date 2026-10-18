import type { Meta, StoryObj } from '@storybook/react-vite'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { Screen } from './Screen.tsx'

// The buttons and cards have no component of their own: they are classes (`.button`, `.choice`, …)
// that the looks dress. They are shown here with the markup the screens use.
const meta = {
  title: 'Onderdelen/Knoppen en kaarten',
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

export const Buttons: Story = {
  name: 'Knoppen',
  render: () => (
    <div className="game-actions">
      <button type="button" className="button button-primary">
        Nieuwe kamer
      </button>
      <button type="button" className="button">
        Meer spellen
      </button>
      <button type="button" className="button" disabled>
        Laden…
      </button>
      <button type="button" className="rematch">
        Nog een keer
      </button>
      <button type="button" className="rematch rematch-quiet">
        Andere vormen kiezen
      </button>
    </div>
  ),
}

export const Cards: Story = {
  name: 'Kaarten',
  render: () => (
    <div className="start">
      <section className="choice choice-primary" aria-labelledby="card-primary">
        <h2 id="card-primary">Een nieuwe kamer starten</h2>
        <p>Je krijgt een code die je aan de anderen geeft.</p>
        <button type="button" className="button button-primary">
          Nieuwe kamer
        </button>
      </section>
      <section className="choice" aria-labelledby="card-plain">
        <h2 id="card-plain">Meedoen met een kamer</h2>
        <div className="field">
          <label htmlFor="card-code">De code van de kamer</label>
          <input id="card-code" type="text" defaultValue="KAAS" />
        </div>
        <p className="message" role="alert">
          Die kamer bestaat niet. Controleer de code.
        </p>
        <button type="button" className="button">
          Meedoen
        </button>
      </section>
    </div>
  ),
}

export const GameListItem: Story = {
  name: 'Een gespeeld spel in de lijst',
  render: () => (
    <ol className="game-list">
      <li>
        <a className="game-item" href="#game">
          <span className="game-when">zondag 18 oktober, 14:02</span>
          <span className="game-players">
            <span className="game-player">
              <ShapeIcon shape="cross" size={28} decorative />
              Anna (kruis)
            </span>
            <span className="game-player">
              <ShapeIcon shape="circle" size={28} decorative />
              Ben (cirkel)
            </span>
          </span>
          <span className="game-result">
            <ShapeIcon shape="cross" size={20} decorative />
            Anna (kruis) heeft gewonnen
          </span>
        </a>
      </li>
    </ol>
  ),
}
