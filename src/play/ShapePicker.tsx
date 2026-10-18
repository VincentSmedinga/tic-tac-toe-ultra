import { useText } from '../i18n/store.ts'
import { useShapeNames } from '../shapes/names.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import './ShapePicker.css'

interface ShapePickerProps {
  /** Who is choosing: "Kies je vorm", "Speler 1 kiest een vorm". */
  label: string
  /** The shape this player has now, if any. */
  value: ShapeId | null
  /** The shapes somebody else has, with who: those can't be picked. */
  taken?: Partial<Record<ShapeId, string>>
  onChange: (shape: ShapeId) => void
}

/** The twelve shapes to choose from: one tap picks, and the ones that are taken say by whom. */
export function ShapePicker({ label, value, taken = {}, onChange }: ShapePickerProps) {
  const t = useText()
  const shapes = useShapeNames()
  return (
    <fieldset className="shape-picker">
      <legend>{label}</legend>
      <div className="shape-picker-grid">
        {SHAPES.map(({ id }) => {
          const name = shapes.name(id)
          const owner = taken[id]
          return (
            <button
              key={id}
              type="button"
              className="shape-choice"
              aria-pressed={value === id}
              aria-label={
                owner === undefined ? name : t('shapePicker.taken', { shape: name, owner })
              }
              disabled={owner !== undefined}
              onClick={() => {
                onChange(id)
              }}
            >
              <ShapeIcon shape={id} size={40} decorative />
              <span className="shape-choice-name" aria-hidden="true">
                {owner ?? name}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
