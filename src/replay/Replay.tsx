import { useEffect, useState } from 'react'
import { replayGame, stateAfter } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { Board } from '../play/Board.tsx'
import { labelOf, shapeOf } from '../play/players.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import './Replay.css'

interface ReplayProps {
  config: GameConfig
  moves: readonly Move[]
  /** Who sat at the game, to call them by the name they typed. */
  players?: readonly { id: string; name?: string | undefined }[]
  /** Shows a button that leaves the replay. */
  onClose?: () => void
}

const SPEEDS = [
  { id: 'slow', label: 'Langzaam', delay: 1600 },
  { id: 'normal', label: 'Normaal', delay: 800 },
  { id: 'fast', label: 'Snel', delay: 300 },
] as const
type SpeedId = (typeof SPEEDS)[number]['id']

/** Looks at a game again, move by move: with buttons, a slider, the arrow keys, or on its own. */
export function Replay({ config, moves, players = [], onClose }: ReplayProps) {
  const [requested, setStep] = useState(0)
  const [autoplay, setAutoplay] = useState(false)
  const [speed, setSpeed] = useState<SpeedId>('normal')

  const replayed = replayGame(config, moves)
  const total = moves.length
  // The game may get shorter under the replay (other moves are passed in): never go past the end.
  const step = Math.min(requested, total)
  // Autoplay stops by itself at the end, without anything having to switch it off.
  const playing = autoplay && step < total
  const delay = SPEEDS.find(({ id }) => id === speed)?.delay ?? 800

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      setStep((current) => current + 1)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [playing, step, delay])

  // The arrow keys, Home and End work wherever the focus is, as long as it isn't in a field that
  // uses them itself (the slider).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof HTMLInputElement) return
      const target = { ArrowLeft: step - 1, ArrowRight: step + 1, Home: 0, End: total }[event.key]
      if (target === undefined) return
      event.preventDefault()
      setAutoplay(false)
      setStep(Math.min(total, Math.max(0, target)))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [step, total])

  if (!replayed.ok) {
    return (
      <p className="message" role="alert">
        Dit spel kan niet worden teruggekeken.
      </p>
    )
  }

  const game = stateAfter(replayed.state, step)
  const last = step > 0 ? moves[step - 1] : undefined
  const who = (id: string) => labelOf(id, players.find((player) => player.id === id)?.name)

  const goTo = (to: number) => {
    setAutoplay(false)
    setStep(to)
  }
  const togglePlay = () => {
    if (playing) {
      setAutoplay(false)
      return
    }
    if (step >= total) setStep(0)
    setAutoplay(true)
  }

  let icon: string | null = null
  let text: string
  if (step === total && game.status.kind === 'won') {
    icon = game.status.winner
    text = `${who(game.status.winner)} heeft gewonnen!`
  } else if (step === total && game.status.kind === 'draw') {
    text = 'Gelijkspel! Niemand heeft gewonnen.'
  } else if (last) {
    icon = last.player
    text = `${who(last.player)} zet`
  } else {
    icon = config.players[0] ?? null
    text = `Het spel begint: ${icon === null ? '' : who(icon)} is de eerste`
  }
  const position = `Zet ${step.toString()} van ${total.toString()}`

  return (
    <section className="game replay" aria-label="Spel terugkijken">
      <p className="game-status" role="status">
        {icon !== null && <ShapeIcon shape={shapeOf(icon)} size={32} decorative />}
        <span>{text}</span>
      </p>

      <Board game={game} onPlay={noop} interactive={false} focusable={false} lastMove={last} />

      <div className="replay-position">
        <label htmlFor="replay-slider">{position}</label>
        <input
          id="replay-slider"
          type="range"
          min={0}
          max={total}
          value={step}
          aria-valuetext={position}
          onChange={(event) => {
            goTo(Number(event.target.value))
          }}
        />
      </div>

      <div className="replay-controls" role="group" aria-label="Bediening">
        <button
          type="button"
          aria-label="Naar het begin"
          disabled={step === 0}
          onClick={() => {
            goTo(0)
          }}
        >
          <Glyph kind="first" />
        </button>
        <button
          type="button"
          aria-label="Een zet terug"
          disabled={step === 0}
          onClick={() => {
            goTo(step - 1)
          }}
        >
          <Glyph kind="back" />
        </button>
        <button
          type="button"
          className="replay-play"
          aria-label={playing ? 'Pauzeren' : 'Afspelen'}
          disabled={total === 0}
          onClick={togglePlay}
        >
          <Glyph kind={playing ? 'pause' : 'play'} size={32} />
        </button>
        <button
          type="button"
          aria-label="Een zet verder"
          disabled={step === total}
          onClick={() => {
            goTo(step + 1)
          }}
        >
          <Glyph kind="forward" />
        </button>
        <button
          type="button"
          aria-label="Naar het einde"
          disabled={step === total}
          onClick={() => {
            goTo(total)
          }}
        >
          <Glyph kind="last" />
        </button>
      </div>

      <div className="replay-speed" role="group" aria-label="Snelheid">
        {SPEEDS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={speed === id}
            onClick={() => {
              setSpeed(id)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {onClose && (
        <button type="button" className="rematch" onClick={onClose}>
          Terug
        </button>
      )}
    </section>
  )
}

function noop() {
  // A replay can't be played.
}

/**
 * The picture on a control, in the way of every player: a step has one triangle and a bar (◀| and
 * |▶), a jump to the start or the end has two (|◀◀ and ▶▶|), and play, alone, is a plain triangle
 * (two bars while it plays), on a round button of its own, so that none of them can be taken for
 * another, with small buttons and without colour.
 */
function Glyph({
  kind,
  size = 24,
}: {
  kind: 'first' | 'back' | 'play' | 'pause' | 'forward' | 'last'
  size?: number
}) {
  const paths = {
    first: 'M4 5v14M15 6L8 12l7 6zM22 6l-7 6 7 6z',
    back: 'M19 5v14M15 5L5 12l10 7z',
    play: 'M8 4l13 8-13 8z',
    pause: 'M8 5v14M16 5v14',
    forward: 'M5 5v14M9 5l10 7-10 7z',
    last: 'M20 5v14M2 6l7 6-7 6zM9 6l7 6-7 6z',
  }
  const jump = kind === 'first' || kind === 'last'
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={kind === 'pause' ? 'none' : 'currentColor'}
      stroke="currentColor"
      strokeWidth={kind === 'pause' ? 4 : jump ? 2.5 : 3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[kind]} />
    </svg>
  )
}
