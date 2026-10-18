import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import './Wordmark.css'

/** The name of the game as a title, "Boter, Kaas en Eieren Ultra", with three of the shapes in it. */
export function Wordmark() {
  return (
    <h1 className="wordmark">
      <span className="wordmark-shapes" aria-hidden="true">
        <ShapeIcon shape="cross" size="1em" decorative />
        <ShapeIcon shape="circle" size="1em" decorative />
        <ShapeIcon shape="heart" size="1em" decorative />
      </span>
      <span className="wordmark-text">Boter, Kaas en Eieren Ultra</span>
    </h1>
  )
}
