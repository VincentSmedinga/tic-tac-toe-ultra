import { useId } from 'react'
import { PATHS, SHAPES } from '../shapes/shapes.ts'
import './Wallpaper.css'

/** Where each of the twelve shapes lies in one tile of the wallpaper, and how it is turned. */
const PLACES = [
  [20, 22, -12],
  [78, 14, 18],
  [140, 30, -6],
  [196, 18, 10],
  [38, 82, 14],
  [100, 90, -16],
  [160, 84, 8],
  [214, 96, -10],
  [14, 150, -8],
  [74, 160, 12],
  [136, 150, -14],
  [196, 162, 6],
] as const

/**
 * The shapes scattered over the whole page, in their own colours, behind everything else: small,
 * as a pattern that repeats, and drawn from the same paths as the shapes on the board. How loud it
 * is, is a matter of the style (`--wallpaper-opacity`); it says nothing to a screen reader.
 */
export function Wallpaper() {
  // One pattern per wallpaper: the play mode has a wallpaper of its own, in the layer.
  const tile = `wallpaper-tile-${useId().replaceAll(':', '')}`
  return (
    <svg className="wallpaper" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={tile} width="240" height="190" patternUnits="userSpaceOnUse">
          {SHAPES.map(({ id }, index) => {
            const [x, y, turn] = PLACES[index] ?? [0, 0, 0]
            return (
              <g
                key={id}
                transform={`translate(${x.toString()} ${y.toString()}) rotate(${turn.toString()}) scale(0.5) translate(-32 -32)`}
                fill="none"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: `var(--shape-${id})` }}
              >
                {PATHS[id].map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            )
          })}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${tile})`} />
    </svg>
  )
}
