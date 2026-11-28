# Game engine and shared code

Read this before changing `shared/` or anything that decides who wins.
The product decisions are in [docs/plan.md](../plan.md), Decisions and Architecture.

- `shared/game/` is pure TypeScript with no browser or Node APIs; the app and the server both use it.
- Import the engine from `shared/game/index.ts`. Never reimplement a rule in the app or the server.
- `createGame` and `applyMove` are immutable and have no side effects.
- A won game has `lines`: every line the last move completes, so a corner can win a row and a column at once.
- A game is a draw when nobody can win any more, not only on a full field: `canStillWin` (`dead.ts`) looks at every window of `winLength` cells and says whether some player can still fill one with the turns they have left.
- `canStillWin` is optimistic on purpose: it is late sometimes but never early (`dead.test.ts` checks every reachable position of small games against a brute force), and a full field never happens, since the last cell either wins or the position was dead already.
- The cells that are still empty when a game is drawn stay empty: the status is `draw` and `applyMove` answers `game-over`, as after a win.
- A game stored before this was played on to a full field after its dead position: `replayGame` reads those moves back (`applyMoveAfterDraw`) and keeps the game drawn. Never use it for a game being played.
- `completesLine(state, cell, player)` says whether a player would complete a line on an empty cell, whoever's turn it is: a look at the position, used by the analysis.
- `chooseMove` (`bot.ts`) is the computer player, see [computer.md](computer.md).
- `tactics.ts` has what the analysis and the computer both look for in a position: winning cells, threats and the cells near the marks.
- A game is its `config` plus its `moves`, kept in the `GameState`. That is what gets stored.
- `replayGame(config, moves)` and `stateAfter(state, count)` (`replay.ts`) read a stored game back and step through it; `replayStates` gives every state along a game in one pass.
- `analyseGame(config, moves)` (`analysis.ts`) ranks every move of a game (`brilliant`, `good`, `dubious`, `mistake`, `blunder`, or none) and `summariseGame` (`summary.ts`) sums it up per player. Both are derived from the stored game and never stored, see [replay-and-games.md](replay-and-games.md).
- A rank is `exact` or `tactical`. Exact: two players, a field of at most 36 cells and at most 12 empty cells, solved by `Solver` (negamax with a table, turned and mirrored positions the same, a budget of positions for a game, solved from the last move back). Tactical: a missed win in one, an unblocked win in one, a double threat, and with two players a double threat handed to the opponent.
- A move after the point where a game was drawn (a game stored before dead positions ended it) gets no rank.
- `analysis.test.ts` has the table test of the 3 × 3 solution: for every reachable position the value of every move against an independent minimax, and the rules that follow (a move that keeps the value is never a mistake, a move that gives it up always is, a move that loses a win is never good, no first move is a mistake).
- The engine works for any field size, winning length and number of players (two to twelve).
- A config may have an `outline` (`outline.ts`): a name for the cells of the `width` × `height` box that exist, and the size must be the outline's.
- Whether a cell exists is `hasCell`, and how many there are is `cellCount`: never `width * height`, and never a null in `cells`, which a missing cell also is.
- A move on a cell that doesn't exist is `out-of-bounds`, like one beside the box.
- The cells of an outline never change once games are stored with it; a different form is a new name.
- A new outline needs a line of every length up to the longest side of its box, or `createGame` needs a check of its own (`outline.test.ts`).
- A room takes an outline only in the one size and row of `OUTLINE_FIELDS` (`shared/room.ts`).
- The analysis only treats positions as the same under the turns and mirrors that keep the field's cells (`symmetriesOf`), and a kept solver is for one outline.
- The player of a game is the shape: the player id, the `player` of a move and the players of a stored game are shape ids (`cross`, `heart`, …).
- `shared/shapes.ts` has the shape ids (thirty-six; new ones go at the end); `src/shapes/shapes.ts` has the drawings and what each comes from, the dictionaries the names.
- The number of players is limited by the room (`PLAYER_LIMITS`), not by the number of shapes.
- The players `X` and `O` only occur in games and rooms stored before shapes could be chosen. They are read as the cross and the circle (`src/play/players.ts`, `upgradeRoom` in `server/room-logic.ts`).
- `shared/room.ts` has the limits of a field and `isValidField`, which the room, the protocol and the field picker (`src/play/FieldPicker.tsx`) share.
- `shared/protocol.ts` has every message and API shape as zod schemas, see [server.md](server.md).
- `shared/stats.ts` works out the statistics, see [stats.md](stats.md).
- Tests next to the code run in Node (`shared/**/*.test.ts`).
