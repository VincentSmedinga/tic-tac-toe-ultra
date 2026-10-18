import { useEffect, useRef, useState } from 'react'
import type { Cell, GameState } from '../../shared/game/index.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { shapeById } from '../shapes/shapes.ts'
import { shapeOf } from './players.ts'

/**
 * A field wider than this gets thin lines and small gaps, so that its cells stay big enough to tap
 * and the shapes keep room to be seen: seven columns of 44 px and six small gaps fit on a phone.
 */
const DENSE_FROM = 5

interface BoardProps {
  game: GameState
  onPlay: (cell: Cell) => void
  /** False when it is not for this player to move (online): no cell can be played. */
  interactive?: boolean
  /** The cell played last, marked so it can be found at a glance (the replay). */
  lastMove?: Cell
  /** False leaves the cells out of the tab order, for a board that is only looked at (a long replay). */
  focusable?: boolean
}

/**
 * The field as a grid of buttons: one tap or key press on an empty cell plays it. A field that is
 * too big for the screen keeps cells that are big enough to tap and is scrolled inside its frame;
 * one that fits fills the room that is left. For the keyboard the board is one stop, as in a grid:
 * Tab goes in and out, the arrow keys, Home and End move over the cells (a field of 19 × 19 would
 * be 361 stops otherwise).
 */
export function Board({
  game,
  onPlay,
  interactive = true,
  lastMove,
  focusable = true,
}: BoardProps) {
  const { width, height } = game.config
  const grid = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  // The cell the keyboard is on: the one that is a tab stop, and the one the arrow keys start from.
  const [active, setActive] = useState(0)
  // A cell on two lines (a corner, the middle) is marked once: the set holds each cell once.
  const winning = new Set(
    game.status.kind === 'won'
      ? game.status.lines.flat().map(({ x, y }) => `${x.toString()},${y.toString()}`)
      : [],
  )
  const playing = game.status.kind === 'playing' && interactive

  const moveTo = (x: number, y: number) => {
    const index = Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))
    setActive(index)
    grid.current?.querySelector<HTMLElement>(`[data-index="${index.toString()}"]`)?.focus()
  }

  // A field that is scrolled inside its frame starts in the middle, where the first marks go.
  useEffect(() => {
    const element = frame.current
    if (!element) return
    element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
  }, [width, height])

  // Not a prop of the element: a grid of buttons has no role that takes key events in JSX, and the
  // keys are for the cell the keyboard is on, so the listener lives next to the cells it moves over.
  useEffect(() => {
    const element = grid.current
    if (!element) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const x = active % width
      const y = Math.floor(active / width)
      const target = {
        ArrowLeft: [x - 1, y],
        ArrowRight: [x + 1, y],
        ArrowUp: [x, y - 1],
        ArrowDown: [x, y + 1],
        Home: [0, y],
        End: [width - 1, y],
      }[event.key]
      if (!target) return
      event.preventDefault()
      moveTo(target[0] ?? x, target[1] ?? y)
    }
    element.addEventListener('keydown', onKeyDown)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
    }
  })

  return (
    <div
      ref={frame}
      className="board-frame"
      data-dense={width > DENSE_FROM || undefined}
      style={{ '--columns': width, '--rows': height } as React.CSSProperties}
    >
      <div
        ref={grid}
        className="board"
        role="group"
        aria-label="Speelveld"
        aria-describedby="board-hint"
      >
        <span id="board-hint" className="sr-only">
          Ga met de pijltjestoetsen over het veld.
        </span>
        {game.cells.map((player, index) => {
          const x = index % width
          const y = Math.floor(index / width)
          const open = playing && player === null
          const content = player === null ? 'leeg' : shapeById(shapeOf(player)).name
          return (
            <button
              key={index}
              type="button"
              className="cell"
              data-index={index}
              aria-label={`Rij ${(y + 1).toString()}, kolom ${(x + 1).toString()}: ${content}`}
              aria-disabled={!open}
              tabIndex={focusable && index === active ? 0 : -1}
              data-winning={winning.has(`${x.toString()},${y.toString()}`) || undefined}
              data-last={(lastMove?.x === x && lastMove.y === y) || undefined}
              onClick={() => {
                setActive(index)
                if (open) onPlay({ x, y })
              }}
            >
              {player !== null && <ShapeIcon shape={shapeOf(player)} size="100%" decorative />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
