import { useState } from 'react'
import { FIELD_LIMITS, FIELD_PRESETS, oddNumbers } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { fieldLabel, longestRow, presetOf, suggestedRow } from './field.ts'
import './FieldPicker.css'

interface FieldPickerProps {
  value: FieldSettings
  onChange: (field: FieldSettings) => void
}

const PRESET_NAMES: Readonly<Record<string, string>> = {
  classic: 'Klassiek',
  bigger: 'Groter',
  big: 'Groot',
}

const SIDES = oddNumbers(FIELD_LIMITS.minSide, FIELD_LIMITS.maxSide)

/**
 * The field of a game: a few ready-made choices, or the width, the height and the number in a row
 * of your own. Everything is odd, so the lists hold only odd numbers; the row can't be longer than
 * the field is wide or high, so it comes down by itself when the field gets smaller.
 */
export function FieldPicker({ value, onChange }: FieldPickerProps) {
  // Your own field stays open while it happens to equal a preset, until another preset is tapped.
  const [custom, setCustom] = useState(() => presetOf(value) === null)
  const preset = custom ? null : presetOf(value)
  const rows = oddNumbers(FIELD_LIMITS.minWin, longestRow(value))

  const suggestion = suggestedRow(value)

  // The row follows the suggestion for as long as it is the suggestion: a row that someone chose
  // for themselves stays (or comes down when the field can't hold it any more).
  const change = (next: Partial<FieldSettings>) => {
    const field = { ...value, ...next }
    // Only a change of the size follows the suggestion: asking for a row is asking for that row.
    const following = next.winLength === undefined && value.winLength === suggestion
    const winLength = following ? suggestedRow(field) : Math.min(field.winLength, longestRow(field))
    onChange({ ...field, winLength })
  }

  return (
    <fieldset className="field-picker">
      <legend>Veld</legend>
      <div className="field-presets">
        {FIELD_PRESETS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={preset === option.id}
            onClick={() => {
              setCustom(false)
              onChange({ width: option.width, height: option.height, winLength: option.winLength })
            }}
          >
            <span className="field-preset-name">{PRESET_NAMES[option.id]}</span>
            <span className="field-preset-size">{fieldLabel(option)}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => {
            setCustom(true)
          }}
        >
          <span className="field-preset-name">Eigen veld</span>
          <span className="field-preset-size">zelf kiezen</span>
        </button>
      </div>

      {custom && (
        <div className="field-custom">
          <label>
            Breedte
            <select
              value={value.width}
              onChange={(event) => {
                change({ width: Number(event.target.value) })
              }}
            >
              {SIDES.map((side) => (
                <option key={side} value={side}>
                  {side}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hoogte
            <select
              value={value.height}
              onChange={(event) => {
                change({ height: Number(event.target.value) })
              }}
            >
              {SIDES.map((side) => (
                <option key={side} value={side}>
                  {side}
                </option>
              ))}
            </select>
          </label>
          <label>
            Op een rij
            <select
              value={value.winLength}
              onChange={(event) => {
                change({ winLength: Number(event.target.value) })
              }}
            >
              {rows.map((row) => (
                <option key={row} value={row}>
                  {row === suggestion ? `${row.toString()} (tip)` : row}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="field-summary">{fieldLabel(value)}</p>
      {custom && value.winLength !== suggestion && (
        <p className="field-tip">
          Tip: op dit veld speelt {suggestion.toString()} op een rij het fijnst.{' '}
          <button
            type="button"
            className="field-tip-button"
            onClick={() => {
              onChange({ ...value, winLength: suggestion })
            }}
          >
            Neem de tip over
          </button>
        </p>
      )}
    </fieldset>
  )
}
