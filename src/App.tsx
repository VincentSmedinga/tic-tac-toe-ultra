import { Game } from './play/Game.tsx'
import { ShapeGallery } from './shapes/ShapeGallery.tsx'

export function App() {
  return (
    <main>
      <h1>Boter, kaas en eieren</h1>
      <Game />
      <details>
        <summary>Alle vormen</summary>
        <ShapeGallery />
      </details>
    </main>
  )
}
