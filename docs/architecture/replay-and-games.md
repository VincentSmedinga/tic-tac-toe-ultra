# Replay and played games

Read this before changing the replay or the pages of played games.
The decisions are in [docs/plan.md](../plan.md), Decisions (games can be watched again, who may see a game).

- `src/replay/Replay.tsx` looks at a game again, given a config and its moves (and optionally who sat where).
- It only reads the game with the engine's `replayGame` and `stateAfter`, so it works for any field and any number of players.
- It has buttons, a slider, the arrow keys, Home and End, and an autoplay.
- Autoplay has one speed: `STEP_MS`, 1.2 seconds a step. A shape takes at most a second to write, so a step is done, and rests a moment, before the next begins. There is no choice of speed.
- Step buttons have a triangle and a bar (◀| and |▶), the jumps to the start and end two triangles (|◀◀ and ▶▶|), and play is alone a round, solid, bigger button in the middle (two bars while it plays), so none is taken for another.
- A look may not make play a pill or a square: `Replay.css` holds it above the looks.
- Both the game on one screen and a room offer the replay with "Kijk terug" once a game is over, next to "Stoppen". A game on one screen is never kept, so its replay is gone when it is left; a game in a room stays in the list of everybody who played it, also of someone who left.
- `src/games/`: `GamesPage` (`/spellen`) lists the finished games of this browser; `GamePage` (`/spel/<id>`) opens one with the replay, the link to copy and "Speel opnieuw". Both go through `games/api.ts`.
- "Speel opnieuw" makes a new room, since every game is still the classic one; once the field and shapes can be chosen it should start a room with the same config.
- A link to a game that doesn't exist, or can't be read, says so.
