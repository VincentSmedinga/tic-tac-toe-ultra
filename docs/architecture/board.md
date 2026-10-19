# The board

Read this before changing `Board`, the cells or the field's styling.
The decision and its reasons are in [docs/plan.md](../plan.md), Decisions, "The board is a grid of lines" and "A field that doesn't fit the screen".

- The board is a grid of lines, not of boxes: cells have no border, radius or gap and touch each other.
- Never put a gap or a border on `.cell`. `Board.test.tsx` and `src/styles/board-lines.test.ts` read the CSS for it.
- The lines between the cells (none around the field) are one decorative SVG behind the cells. `lines.ts` makes them, in units of a cell.
- Every line is in the SVG twice, straight and by hand, with a weight and the same wobble every time.
- A look sets `--board-max`, `--line-width`, `--line-color` and `--cell-radius` and shows `.board-line-straight` or `.board-line-hand`.
- Getekend draws by hand in ink, Speels thick and round in the edge's colour (the line token in dark), Rustig thin and straight.
- A cell is marked on `.cell::before`, a patch a little smaller than the cell that keeps away from the lines: the hover tint, `data-last` (tint and ring), `data-winning` (orange-yellow).
- The focus ring is inside the patch too, never a border.
- The field is a see-through `--page` surface (`--board-surface`, 62 %, with a blur of what is behind it, drawn by `.board::before`), so the theme shows through and the shapes keep their contrast over a wallpaper.
- `Board` is a frame (`.board-frame`) with the grid in it. The frame scrolls what doesn't fit; `--columns`, `--rows` and `--cell-min` size it in `Game.css`.
- A cell is never smaller than `--cell-min` (2.75 rem, a finger).
- The grid is one tab stop with arrow-key navigation (Home and End too).
- The page itself never scrolls sideways.
- The winning cells fade in after the winning shape is written (`data-win-late`), see [motion.md](motion.md).
- The full screen layout of the board is in [play-mode.md](play-mode.md).
