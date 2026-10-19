# Motion

Read this before adding or changing any animation.
The decisions are in [docs/plan.md](../plan.md), Animations; the ideas are issue #31.

## Rules for any animation

- Only transforms, opacity and SVG strokes. Never anything that changes the size of a cell or moves the board.
- The game state never waits for an animation: a move counts at once.
- Earlier shapes keep being written while the next is placed, so a fast replay shows nothing cut off.
- A rematch, or a shape that is taken off the field, stops its animation.
- The finished shape is the element's own style. The animation only hides what isn't there yet, so cancelling it leaves the whole shape.
- Nothing flashes more than three times a second.
- No animation library: the Web Animations API is enough.
- The status line and screen readers are not touched.
- A new animation gets its variants in `arrival.ts` (or a file next to it), a test of the picker, and a story.

## How a shape is written (`src/motion/`)

- `arrival.ts` is pure: a function of (seed, number of the move, lengths of the strokes from `shapes/length.ts`) into an `ArrivalPlan`.
- A variant is never the one of the move before; the plan has the order, direction, delay and duration of every stroke.
- Every shape takes the same time, `MIN_ARRIVAL_MS` to `MAX_ARRIVAL_MS` (0.8 to 1 second), shared out over its strokes by length, so one speed holds for all.
- The circle, the oval and the diamond are one line, written with the clock or against it; the square goes round from any of its sides either way. `isRing` in `shapes/closure.ts` says which shapes are rings.
- `random.ts` is a seedable generator (`createRandom`, `seedFrom`).
- `play.ts` plays a plan on a shape's SVG and returns what cancels it.
- `preference.ts` is the Animaties switch (Aan or Uit in the footer, per device) on top of `prefers-reduced-motion`. `useMotion` gives full, gentle (only a fade) or off.
- `Board` asks `useArrival` (`play/useArrival.ts`) which shapes arrived since it was first shown, one new shape at a time.
- A board first shown with moves, or a jump over several moves, writes nothing.
- Each arrived `ShapeIcon` gets `arrival`, which sets `data-arrival` to the variant and plays it before the first paint.
- `seed` fixes the plan (tests, later the replay); otherwise a board has a seed of its own.
