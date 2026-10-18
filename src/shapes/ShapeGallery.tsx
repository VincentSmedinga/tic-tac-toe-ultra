import { ShapeIcon } from './ShapeIcon.tsx'
import { SHAPES } from './shapes.ts'
import './ShapeGallery.css'

/** All shapes, large and at the smallest sizes they are used at. */
export function ShapeGallery() {
  return (
    <section aria-labelledby="shape-gallery-title">
      <h2 id="shape-gallery-title">Vormen</h2>
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
    </section>
  )
}
