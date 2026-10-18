import type { Cell, GameState } from '../../shared/game/index.ts'
import { ShapeIcon } from '../shapes/ShapeIcon.tsx'
import { shapeById } from '../shapes/shapes.ts'
import { shapeOf } from './players.ts'

interface BoardProps {
  game: GameState
  onPlay: (cell: Cell) => void
  /** False when it is not for this player to move (online): no cell can be played. */
  interactive?: boolean
}

/** The field as a grid of buttons: one tap or key press on an empty cell plays it. */
export function Board({ game, onPlay, interactive = true }: BoardProps) {
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
            data-winning={winning.has(`${x.toString()},${y.toString()}`) || undefined}
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
