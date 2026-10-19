# Game engine and shared code

Read this before changing `shared/` or anything that decides who wins.
The product decisions are in [docs/plan.md](../plan.md), Decisions and Architecture.

- `shared/game/` is pure TypeScript with no browser or Node APIs; the app and the server both use it.
- Import the engine from `shared/game/index.ts`. Never reimplement a rule in the app or the server.
- `createGame` and `applyMove` are immutable and have no side effects.
- A won game has `lines`: every line the last move completes, so a corner can win a row and a column at once.
- A game is its `config` plus its `moves`, kept in the `GameState`. That is what gets stored.
- `replayGame(config, moves)` and `stateAfter(state, count)` (`replay.ts`) read a stored game back and step through it.
- The engine works for any field size, winning length and number of players (two to twelve).
- The player of a game is the shape: the player id, the `player` of a move and the players of a stored game are shape ids (`cross`, `heart`, …).
- `shared/shapes.ts` has the shape ids; `src/shapes/shapes.ts` has the names and drawings.
- The players `X` and `O` only occur in games and rooms stored before shapes could be chosen. They are read as the cross and the circle (`src/play/players.ts`, `upgradeRoom` in `server/room-logic.ts`).
- `shared/room.ts` has the limits of a field and `isValidField`, which the room, the protocol and the field picker (`src/play/FieldPicker.tsx`) share.
- `shared/protocol.ts` has every message and API shape as zod schemas, see [server.md](server.md).
- `shared/stats.ts` works out the statistics, see [stats.md](stats.md).
- Tests next to the code run in Node (`shared/**/*.test.ts`).
