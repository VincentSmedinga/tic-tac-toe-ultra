import { useEffect, useState } from 'react'
import { replayGame, stateAfter } from '../../shared/game/index.ts'
import type { GameConfig, Move } from '../../shared/game/index.ts'
import { useText } from '../i18n/store.ts'
import { Board } from '../play/Board.tsx'
import { usePlayerNames, shapeOf } from '../play/players.ts'
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

/**
 * Milliseconds between two steps when it plays on its own. One speed, chosen to go with the writing
 * of the shapes (src/motion/): a shape takes 0.8 to 1 second, so every step is done, and rests a
 * moment, before the next one begins.
 */
export const STEP_MS = 1200

/** Looks at a game again, move by move: with buttons, a slider, the arrow keys, or on its own. */
export function Replay({ config, moves, players = [], onClose }: ReplayProps) {
  const t = useText()
  const { labelOf } = usePlayerNames()
  const [requested, setStep] = useState(0)
  const [autoplay, setAutoplay] = useState(false)

  const replayed = replayGame(config, moves)
  const total = moves.length
  // The game may get shorter under the replay (other moves are passed in): never go past the end.
  const step = Math.min(requested, total)
  // Autoplay stops by itself at the end, without anything having to switch it off.
  const playing = autoplay && step < total

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => {
      setStep((current) => current + 1)
    }, STEP_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [playing, step])

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
        {t('replay.invalid')}
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
    text = t('status.won', { name: who(game.status.winner) })
  } else if (step === total && game.status.kind === 'draw') {
    text = t('status.draw')
  } else if (last) {
    icon = last.player
    text = t('replay.moves', { name: who(last.player) })
  } else {
    icon = config.players[0] ?? null
    text = icon === null ? t('replay.beginsPlain') : t('replay.begins', { name: who(icon) })
  }
  const position = t('replay.position', { step, total })

  return (
    <section className="game replay" aria-label={t('replay.label')}>
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

      <div className="replay-controls" role="group" aria-label={t('replay.controls')}>
        <button
          type="button"
          aria-label={t('replay.first')}
          disabled={step === 0}
          onClick={() => {
            goTo(0)
          }}
        >
          <Glyph kind="first" />
        </button>
        <button
          type="button"
          aria-label={t('replay.back')}
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
          aria-label={playing ? t('replay.pause') : t('replay.play')}
          disabled={total === 0}
          onClick={togglePlay}
        >
          <Glyph kind={playing ? 'pause' : 'play'} size={32} />
        </button>
        <button
          type="button"
          aria-label={t('replay.forward')}
          disabled={step === total}
          onClick={() => {
            goTo(step + 1)
          }}
        >
          <Glyph kind="forward" />
        </button>
        <button
          type="button"
          aria-label={t('replay.last')}
          disabled={step === total}
          onClick={() => {
            goTo(total)
          }}
        >
          <Glyph kind="last" />
        </button>
      </div>

      {onClose && (
        <button type="button" className="rematch" onClick={onClose}>
          {t('replay.close')}
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
