import type { Cell, GameState } from '../../shared/game/index.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { shapeById } from '../shapes/shapes.ts'
import { shapeOf } from './players.ts'

/** A field wider than this gets thin lines and small gaps, so the shapes keep room to be seen. */
const DENSE_FROM = 9

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

/** The field as a grid of buttons: one tap or key press on an empty cell plays it. */
export function Board({
  game,
  onPlay,
  interactive = true,
  lastMove,
  focusable = true,
}: BoardProps) {
  const { width } = game.config
  // A cell on two lines (a corner, the middle) is marked once: the set holds each cell once.
  const winning = new Set(
    game.status.kind === 'won'
      ? game.status.lines.flat().map(({ x, y }) => `${x.toString()},${y.toString()}`)
      : [],
  )
  const playing = game.status.kind === 'playing' && interactive

  return (
    <div
      className="board"
      role="group"
      aria-label="Speelveld"
      data-dense={width > DENSE_FROM || undefined}
      style={{ '--columns': width } as React.CSSProperties}
    >
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
            aria-label={`Rij ${(y + 1).toString()}, kolom ${(x + 1).toString()}: ${content}`}
            aria-disabled={!open}
            tabIndex={focusable ? undefined : -1}
            data-winning={winning.has(`${x.toString()},${y.toString()}`) || undefined}
            data-last={(lastMove?.x === x && lastMove.y === y) || undefined}
            onClick={() => {
              if (open) onPlay({ x, y })
            }}
          >
            {player !== null && <ShapeIcon shape={shapeOf(player)} size="100%" decorative />}
          </button>
        )
      })}
    </div>
  )
}
