import './FieldPicker.css'

export interface Choice<T extends string> {
  readonly id: T
  readonly name: string
  /** What the choice means, in a few words under its name. */
  readonly hint?: string
}

/** A few ready-made choices side by side, of which one is on: they look like those of the field. */
export function Choices<T extends string>({
  legend,
  choices,
  value,
  onChange,
}: {
  legend: string
  choices: readonly Choice<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="field-picker">
      <legend>{legend}</legend>
      <div className="field-presets">
        {choices.map(({ id, name, hint }) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => {
              onChange(id)
            }}
          >
            <span className="field-preset-name">{name}</span>
            {hint !== undefined && <span className="field-preset-size">{hint}</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
