import { useId } from 'react'
import { PATHS, SHAPES } from '../shapes/shapes.ts'
import './Wallpaper.css'

/**
 * Where each of the thirty-six shapes lies in one tile of the wallpaper, and how it is turned: six
 * rows of six, the odd rows shifted half a step, each a little off its place.
 */
const PLACES = [
  [25, 32, 12],
  [88, 32, -7],
  [155, 27, 15],
  [214, 31, -6],
  [275, 23, -6],
  [338, 31, -14],
  [55, 92, -14],
  [105, 98, -5],
  [161, 88, -14],
  [218, 97, 10],
  [281, 94, -13],
  [333, 95, 12],
  [20, 161, -12],
  [90, 155, 13],
  [144, 162, 10],
  [217, 154, 5],
  [269, 160, -11],
  [331, 164, 11],
  [50, 217, -8],
  [108, 231, -12],
  [167, 228, 11],
  [219, 226, -17],
  [284, 221, 6],
  [334, 222, -11],
  [30, 297, -7],
  [83, 294, -5],
  [143, 290, 7],
  [215, 291, -12],
  [276, 286, -11],
  [340, 289, -11],
  [55, 352, -9],
  [117, 358, 5],
  [164, 351, 18],
  [227, 359, -5],
  [276, 352, 9],
  [330, 361, 18],
] as const

/**
 * The shapes are not laid out in the order of the set: stepping through it by seven puts shapes
 * that are close in the set (the drawn ones, the Greek letters) far apart on the page.
 */
const STEP = 7

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
        <pattern id={tile} width="360" height="384" patternUnits="userSpaceOnUse">
          {SHAPES.map(({ id }, index) => {
            const [x, y, turn] = PLACES[(index * STEP) % PLACES.length] ?? [0, 0, 0]
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
