import { useState } from 'react'
import { CLASSIC_FIELD, DEFAULT_PLAYERS, PLAYER_LIMITS } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { useText } from '../i18n/store.ts'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { useScrollToTop } from '../online/scroll.ts'
import { FieldPicker } from './FieldPicker.tsx'
import { LocalPlay } from './LocalPlay.tsx'
import { ShapePicker } from './ShapePicker.tsx'
import './Game.css'

/** The shapes of a game on one screen, in the order of the players: the first one starts. */
type Shapes = readonly ShapeId[]

/** Two players take turns on one screen: first they choose a shape each and the field, then they play. */
export function Game() {
  const [chosen, setChosen] = useState<{ shapes: Shapes; field: FieldSettings } | null>(null)
  if (!chosen) {
    return (
      <ChooseShapes
        onStart={(shapes, field) => {
          setChosen({ shapes, field })
        }}
      />
    )
  }
  return (
    <LocalPlay
      shapes={chosen.shapes}
      field={chosen.field}
      onChooseAgain={() => {
        setChosen(null)
      }}
    />
  )
}

/** The shapes that are ready for this many players: the first ones, for whoever doesn't care. */
function defaultShapes(count: number): ShapeId[] {
  return SHAPES.slice(0, count).map(({ id }) => id)
}

/** Everybody chooses a shape, the cross and the circle being ready for the first two players. */
function ChooseShapes({ onStart }: { onStart: (shapes: Shapes, field: FieldSettings) => void }) {
  const t = useText()
  const [shapes, setShapes] = useState<ShapeId[]>(defaultShapes(DEFAULT_PLAYERS))
  const [field, setField] = useState<FieldSettings>(CLASSIC_FIELD)
  // The page was scrolled to the button that leads to the board (or comes back from it).
  useScrollToTop('choose')

  // More players get the first shapes that are free, fewer players leave the last ones out.
  const setCount = (count: number) => {
    setShapes((current) => {
      if (count <= current.length) return current.slice(0, count)
      const free = SHAPES.map(({ id }) => id).filter((id) => !current.includes(id))
      return [...current, ...free.slice(0, count - current.length)]
    })
  }

  return (
    <section className="game choose-shapes" aria-label={t('play.chooseShapes')}>
      <div className="player-count-row">
        <label htmlFor="local-player-count">{t('play.playerCount')}</label>
        <select
          id="local-player-count"
          className="player-count"
          value={shapes.length}
          onChange={(event) => {
            setCount(Number(event.target.value))
          }}
        >
          {Array.from(
            { length: PLAYER_LIMITS.max - PLAYER_LIMITS.min + 1 },
            (_, index) => PLAYER_LIMITS.min + index,
          ).map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>
      {shapes.map((shape, index) => (
        <ShapePicker
          key={index}
          label={t('play.playerChooses', { number: index + 1 })}
          value={shape}
          taken={Object.fromEntries(
            shapes.flatMap((other, otherIndex) =>
              otherIndex === index ? [] : [[other, t('play.takenBy', { number: otherIndex + 1 })]],
            ),
          )}
          onChange={(chosen) => {
            setShapes((current) => current.map((old, at) => (at === index ? chosen : old)))
          }}
        />
      ))}
      <FieldPicker value={field} onChange={setField} />
      <button
        type="button"
        className="rematch"
        onClick={() => {
          onStart(shapes, field)
        }}
      >
        {t('play.start')}
      </button>
    </section>
  )
}
