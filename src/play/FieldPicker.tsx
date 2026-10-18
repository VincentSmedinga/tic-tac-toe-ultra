import { useState } from 'react'
import { useText } from '../i18n/store.ts'
import { FIELD_LIMITS, FIELD_PRESETS, oddNumbers } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { fieldLabel, longestRow, presetOf, suggestedRow } from './field.ts'
import './FieldPicker.css'

interface FieldPickerProps {
  value: FieldSettings
  onChange: (field: FieldSettings) => void
}

const SIDES = oddNumbers(FIELD_LIMITS.minSide, FIELD_LIMITS.maxSide)

/**
 * The field of a game: a few ready-made choices, or the width, the height and the number in a row
 * of your own. Everything is odd, so the lists hold only odd numbers; the row can't be longer than
 * the field is wide or high, so it comes down by itself when the field gets smaller.
 */
export function FieldPicker({ value, onChange }: FieldPickerProps) {
  const t = useText()
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
      <legend>{t('field.legend')}</legend>
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
            <span className="field-preset-name">{t(`field.preset.${option.id}`)}</span>
            <span className="field-preset-size">{fieldLabel(t, option)}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => {
            setCustom(true)
          }}
        >
          <span className="field-preset-name">{t('field.custom')}</span>
          <span className="field-preset-size">{t('field.customHint')}</span>
        </button>
      </div>

      {custom && (
        <div className="field-custom">
          <label>
            {t('field.width')}
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
            {t('field.height')}
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
            {t('field.row')}
            <select
              value={value.winLength}
              onChange={(event) => {
                change({ winLength: Number(event.target.value) })
              }}
            >
              {rows.map((row) => (
                <option key={row} value={row}>
                  {row === suggestion ? t('field.rowTip', { row }) : row}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="field-summary">{fieldLabel(t, value)}</p>
      {custom && value.winLength !== suggestion && (
        <p className="field-tip">
          {t('field.tip', { row: suggestion })}{' '}
          <button
            type="button"
            className="field-tip-button"
            onClick={() => {
              onChange({ ...value, winLength: suggestion })
            }}
          >
            {t('field.takeTip')}
          </button>
        </p>
      )}
    </fieldset>
  )
}
