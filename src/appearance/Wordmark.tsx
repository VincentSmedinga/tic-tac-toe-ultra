import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import './Wordmark.css'

/** The name of the game as a title, "Boter, kaas en eieren Ultra", with three of the shapes in it. */
export function Wordmark() {
  return (
    <h1 className="wordmark">
      <span className="wordmark-shapes" aria-hidden="true">
        <ShapeIcon shape="cross" size="1em" decorative />
        <ShapeIcon shape="circle" size="1em" decorative />
        <ShapeIcon shape="heart" size="1em" decorative />
      </span>
      <span className="wordmark-text">Boter, kaas en eieren</span>{' '}
      <span className="wordmark-ultra">Ultra</span>
    </h1>
  )
}
