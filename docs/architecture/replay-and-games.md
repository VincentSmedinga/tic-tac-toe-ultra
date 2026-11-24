# Replay and played games

Read this before changing the replay or the pages of played games.
The decisions are in [docs/plan.md](../plan.md), Decisions (games can be watched again, who may see a game).

- `src/replay/Replay.tsx` looks at a game again, given a config and its moves (and optionally who sat where).
- It only reads the game with the engine's `replayGame` and `stateAfter`, so it works for any field and any number of players.
- A game that ended in a draw with cells left shows "Gelijkspel! Niemand kan meer winnen." at its last step; a game stored before that, played on to a full field, shows the same.
- It has buttons, a slider, the arrow keys, Home and End, and an autoplay.
- Autoplay has one speed: `STEP_MS`, 1.2 seconds a step. A shape takes at most a second to write, so a step is done, and rests a moment, before the next begins. There is no choice of speed.
- Step buttons have a triangle and a bar (◀| and |▶), the jumps to the start and end two triangles (|◀◀ and ▶▶|), and play is alone a round, solid, bigger button in the middle (two bars while it plays), so none is taken for another.
- A look may not make play a pill or a square: `Replay.css` holds it above the looks.
- Both the game on one screen and a room offer the replay with "Kijk terug" once a game is over, next to "Stoppen". A game on one screen is never kept, so its replay is gone when it is left; a game in a room stays in the list of everybody who played it, also of someone who left.
- `src/games/`: `GamesPage` (`/spellen`) lists the finished games of this browser; `GamePage` (`/spel/<id>`) opens one with the replay, the link to copy and "Speel opnieuw". Both go through `games/api.ts`.
- "Speel opnieuw" makes a new room, since every game is still the classic one; once the field and shapes can be chosen it should start a room with the same config.
- A link to a game that doesn't exist, or can't be read, says so.

## Ranks and the summary

Read this before changing how a game is judged or shown; the rules and the reasons are in [docs/plan.md](../plan.md), Decisions (the moves of a finished game are ranked), and the engine part is in [game-engine.md](game-engine.md).

- `Replay` ranks the moves of the game it shows, always: it only ever shows a finished game. Nothing about ranks is shown while a game is played.
- The analysis is never stored or sent: no field in `StoredGame`, no endpoint, and the page of a game asks for the game only (`GamePage.test.tsx`).
- `useAnalysis` runs an `Analyser` (`analyse.ts`): the real one, `analyseOffThread`, uses one Web Worker (`analysis.worker.ts`) for every game, and does the work on the page only when there is no worker or it fails. A test or a story passes its own `analyse` prop; `analyse.test.ts` fakes the worker.
- `keptSolver.ts` keeps one `Solver` per field (size and winning length) where the analysis runs, so a 3 × 3 is solved once.
- While it works the line under the slider says "Zetten beoordelen…" and everything else works; the list and the summary appear when it is there.
- The line under the slider has the rank of the move just made (`{name} · {symbol} {rank}`), "(minder zeker)" for a tactical one, and, for a mistake or a blunder, "Beter was: …" with the cells that were better; those cells have `data-better` and a dashed ring (`Replay.css`).
- The list along the slider has one button per judged move and jumps there. The summary's best move and biggest mistake do the same and put the focus on the slider.
- A rank is a badge with the symbol and always the word next to it; the badges differ by fill and border, not by colour, so they work in all three looks and light and dark. The symbol is `aria-hidden`, the word is what a screen reader gets.
- `Summary.tsx` is the summary; it says when only the clearest moves were judged and gives no accuracy then. `startAtSummary` opens the replay at its end with the summary focused: it is what "Bekijk samenvatting" next to "Kijk terug" does, in a room and on one screen.
- Stories: "Zetten beoordeeld", "Samenvatting", "Samenvatting met drie spelers" and "Zetten beoordelen" in `Replay.stories.tsx`.
- Checked by `shared/game/analysis.test.ts`, `src/replay/Ranks.test.tsx`, `src/replay/analyse.test.ts`, `src/games/GamePage.test.tsx` and `e2e/ranks.spec.ts`.
