import { ShapeIcon } from './ShapeIcon.tsx'
import { SHAPES } from './shapes.ts'
import './ShapeGallery.css'

/** All shapes, large and at the smallest sizes they are used at. */
export function ShapeGallery() {
  return (
    <section aria-labelledby="shape-gallery-title">
      <h2 id="shape-gallery-title">Vormen</h2>
      <p>Alle twaalf naast elkaar, zoals ze op het bord staan:</p>
      <div className="shape-strip" aria-hidden="true">
        {SHAPES.map(({ id }) => (
          <ShapeIcon key={id} shape={id} size={36} decorative />
        ))}
      </div>
      <div className="shape-gallery">
        {SHAPES.map(({ id, name, marker }) => (
          <figure key={id}>
            <ShapeIcon shape={id} size={80} />
            <div className="shape-gallery-small">
              <ShapeIcon shape={id} size={32} />
              <ShapeIcon shape={id} size={20} />
            </div>
            <figcaption>
              {name}
              <small>{marker}</small>
            </figcaption>
          </figure>
        ))}
      </div>

      <details className="shape-pairs">
        <summary>Alle paren die tegen elkaar kunnen spelen</summary>
        <div className="shape-pairs-grid" aria-hidden="true">
          {SHAPES.flatMap((first, index) =>
            SHAPES.slice(index + 1).map((second) => (
              <span key={`${first.id}-${second.id}`} className="shape-pair">
                <ShapeIcon shape={first.id} size={28} decorative />
                <ShapeIcon shape={second.id} size={28} decorative />
              </span>
            )),
          )}
        </div>
      </details>
    </section>
  )
}
