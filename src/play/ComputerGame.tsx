import { useState } from 'react'
import { BOT_CHARACTERS, BOT_LEVELS } from '../../shared/game/index.ts'
import type { BotCharacter, BotLevel } from '../../shared/game/index.ts'
import { CLASSIC_FIELD } from '../../shared/room.ts'
import type { FieldSettings } from '../../shared/room.ts'
import { useText } from '../i18n/store.ts'
import type { PlainKey } from '../i18n/types.ts'
import { useScrollToTop } from '../online/scroll.ts'
import { useShapeNames } from '../shapes/names.ts'
import { SHAPES } from '../shapes/shapes.ts'
import type { ShapeId } from '../shapes/shapes.ts'
import { Choices } from './Choices.tsx'
import {
  CHARACTER_NAMES,
  hasCharacters,
  LEVEL_NAMES,
  opponentLabel,
  otherShape,
  thinkingPause,
} from './computer.ts'
import type { Opponent } from './computer.ts'
import { FieldPicker } from './FieldPicker.tsx'
import { isClassic } from './field.ts'
import { LocalPlay } from './LocalPlay.tsx'
import { ShapePicker } from './ShapePicker.tsx'
import { thinkOffThread } from './think.ts'
import './Game.css'
import '../online/Online.css'

/** What is chosen for a game against the computer. */
interface ComputerChoice {
  level: BotLevel
  character: BotCharacter
  field: FieldSettings
  starts: 'you' | 'computer'
  yours: ShapeId
  theirs: ShapeId
}

const FIRST_CHOICE: ComputerChoice = {
  level: 'medium',
  character: 'balanced',
  field: CLASSIC_FIELD,
  starts: 'you',
  yours: 'cross',
  theirs: 'circle',
}

const LEVEL_HINTS: Readonly<Record<BotLevel, PlainKey>> = {
  easy: 'computer.level.easy.hint',
  medium: 'computer.level.medium.hint',
  hard: 'computer.level.hard.hint',
}

const CHARACTER_HINTS: Readonly<Record<BotCharacter, PlainKey>> = {
  balanced: 'computer.character.balanced.hint',
  defender: 'computer.character.defender.hint',
  attacker: 'computer.character.attacker.hint',
  wild: 'computer.character.wild.hint',
}

interface ComputerGameProps {
  /** Where the computer thinks and how long it waits: other ones in a test or a story. */
  think?: Opponent['think']
  pause?: Opponent['pause']
}

/** One player against the computer on this screen: first the choices, then the game. */
export function ComputerGame({ think = thinkOffThread, pause = thinkingPause }: ComputerGameProps) {
  const t = useText()
  const [choice, setChoice] = useState<ComputerChoice>(FIRST_CHOICE)
  const [playing, setPlaying] = useState(false)
  if (!playing) {
    return (
      <ComputerSetup
        value={choice}
        onChange={setChoice}
        onStart={() => {
          setPlaying(true)
        }}
      />
    )
  }
  const { level, field, starts, yours, theirs } = choice
  // On a field without a choice of character the computer is an even-handed one.
  const bot = { level, character: hasCharacters(field) ? choice.character : ('balanced' as const) }
  return (
    <LocalPlay
      shapes={starts === 'you' ? [yours, theirs] : [theirs, yours]}
      field={field}
      opponent={{ shape: theirs, bot, label: opponentLabel(t, bot, field), think, pause }}
      onChooseAgain={() => {
        setPlaying(false)
      }}
    />
  )
}

/** The field, how strong the computer is, what it is like, who starts and the two shapes. */
function ComputerSetup({
  value,
  onChange,
  onStart,
}: {
  value: ComputerChoice
  onChange: (value: ComputerChoice) => void
  onStart: () => void
}) {
  const t = useText()
  const shapes = useShapeNames()
  // The computer's shape is ready; the way to change it is behind a line that says which it is.
  const [choosingTheirs, setChoosingTheirs] = useState(false)
  useScrollToTop('choose')
  const change = (next: Partial<ComputerChoice>) => {
    onChange({ ...value, ...next })
  }
  const all = SHAPES.map(({ id }) => id)

  return (
    <section className="game choose-shapes" aria-label={t('computer.title')}>
      <FieldPicker
        value={value.field}
        onChange={(field) => {
          change({ field })
        }}
      />
      <Choices
        legend={t('computer.level')}
        value={value.level}
        choices={BOT_LEVELS.map((level) => ({
          id: level,
          name: t(LEVEL_NAMES[level]),
          // On the classic field the hard level solves every position: say so.
          hint: t(
            level === 'hard' && isClassic(value.field)
              ? 'computer.level.hard.classic'
              : LEVEL_HINTS[level],
          ),
        }))}
        onChange={(level) => {
          change({ level })
        }}
      />
      {hasCharacters(value.field) ? (
        <Choices
          legend={t('computer.character')}
          value={value.character}
          choices={BOT_CHARACTERS.map((character) => ({
            id: character,
            name: t(CHARACTER_NAMES[character]),
            hint: t(CHARACTER_HINTS[character]),
          }))}
          onChange={(character) => {
            change({ character })
          }}
        />
      ) : (
        <p className="field-tip">{t('computer.character.bigger')}</p>
      )}
      <Choices
        legend={t('computer.starts')}
        value={value.starts}
        choices={[
          { id: 'you', name: t('computer.starts.you') },
          { id: 'computer', name: t('computer.name') },
        ]}
        onChange={(starts) => {
          change({ starts })
        }}
      />
      <ShapePicker
        label={t('room.pickShape')}
        value={value.yours}
        onChange={(yours) => {
          // The computer gives way when you take its shape.
          change({ yours, theirs: otherShape(all, yours, value.theirs) })
        }}
      />
      <button
        type="button"
        className="adjust"
        aria-expanded={choosingTheirs}
        aria-controls="computer-shape"
        onClick={() => {
          setChoosingTheirs(!choosingTheirs)
        }}
      >
        {t('computer.itsShape', { shape: shapes.name(value.theirs) })} · {t('start.create.adjust')}
      </button>
      {choosingTheirs && (
        <div id="computer-shape">
          <ShapePicker
            label={t('computer.itsShape.choose')}
            value={value.theirs}
            taken={{ [value.yours]: t('computer.takenByYou') }}
            onChange={(theirs) => {
              change({ theirs })
            }}
          />
        </div>
      )}
      <button type="button" className="rematch" onClick={onStart}>
        {t('play.start')}
      </button>
    </section>
  )
}
