import './Segmented.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  hint?: string
  /** The language of the label, when it is not the page's (the names of the languages). */
  lang?: string
}

interface SegmentedProps<T extends string> {
  /** The accessible name of the group, and what is shown above it. */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** A row of buttons of which one is pressed. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      <span className="segmented-label" aria-hidden="true">
        {label}
      </span>
      <div className="segmented-options">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            lang={option.lang}
            aria-pressed={option.value === value}
            onClick={() => {
              onChange(option.value)
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
