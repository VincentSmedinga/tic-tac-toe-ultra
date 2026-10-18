# Plan

## Goal

A game where many players play noughts and crosses together on one big field, each with their own shape. Version 1 is plain tic-tac-toe (3×3, two players, X and O), played online and live, each player on their own device. It is built so that a bigger field, more players, "k in a row" and more shapes are configuration and new drawings afterwards.

## Decisions

- **Online, live.** Players join a room and see each other's moves immediately.
- **Version 1 is classic 3×3 with two players**, but the engine is already written for N players, any field size and any winning length.
- **Games can be watched again.** A game is its config plus its moves, which the engine keeps; `replayGame` reads a stored game back and `stateAfter` steps through it. Saving the games and the replay screen are milestone 4.
- **Finished games are kept in an archive.** A second Durable Object class, `Archive` (SQLite storage, one object named `games`), holds every finished game of every room, so it outlives the room, which is deleted a day after its last move. It was chosen over D1 because it needs no database to create and no extra rights for the deploy token, and a pull request's preview Worker gets an archive of its own, like its rooms; one object holds about 10 GB, and a game is a few hundred bytes, so a family never gets near it. A game is saved by the room at the moment the move that wins or draws it is played, whoever is still connected, and once: the room gives it a random id (96 bits, 16 URL-safe characters, `/api/games/:id`) and remembers it in its state until a rematch, so the players are told where the game is kept (`gameId` in the `state` message). A game that nobody finishes is **dropped**: it has no result, and the room that held it expires. Stored games are never deleted.
- **Who may see a game.** Anyone who has the id, and nobody who doesn't: the id is the link, and it can't be guessed. The repository is public but the games aren't. A game holds the shapes' moves and the names that were typed, never a token. The tokens of the players are kept only as SHA-256 hashes, in a table of their own, to find "your games" again (#17): a list is only for the browser that played, and there is no list of everybody's games.
- **TypeScript, React and Vite on Cloudflare.** The same set-up as [Blokhut](https://github.com/VincentSmedinga/blokhut): pnpm, Node 24, Vitest, Playwright, Storybook, Cloudflare, Conventional Commits, pull requests only. Realtime through Durable Objects.
- **One Cloudflare Worker for the site and the rooms.** A Durable Object can't live in a Pages project, so the app is a Worker with static assets (`wrangler.jsonc`, `@cloudflare/vite-plugin`) and the rooms are Durable Objects in the same Worker; `pnpm dev` runs all of it in one Vite server. A pull request's preview is a Worker of its own (`tic-tac-toe-ultra-pr-<number>`, with its own rooms), deleted when the pull request closes, because Workers with Durable Objects get no version-URL previews. SQLite-backed Durable Objects run on the Workers Free plan; the WebSocket Hibernation API keeps an idle room free of duration charges.
- **Players can type an optional name.** It is kept in the room, not in an account; the shape is what identifies a player.

## Architecture

- `shared/game/`: the game engine, pure TypeScript with no browser or Node APIs. `GameConfig { width, height, winLength, players[] }`, `applyMove(state, move)` with turn order for N players, and a win and draw check that only looks at the last move in four directions, so it also works on a big field. Version 1 uses `{3, 3, 3, [X, O]}`.
- `shared/protocol.ts`: the messages between client and server (zod), so both sides share the same types. A message from a player is `join` (with a token that is kept in the browser, and an optional name), `move` or `rematch`; the server answers every change with the whole room as a `state` (config plus moves; the receiver rebuilds the game with the engine) and tells only the sender about an `error`. `shared/room.ts` has the players of a room, the game of each round and the room codes: four consonants, so they never spell a word.
- `src/`: the React app: board, shapes, lobby. Shapes are a registry of SVG components; a player is assigned one, and the engine only knows a player id.
- `server/`: the room as a Cloudflare Durable Object with WebSocket, and the archive of finished games (`archive.ts` for the object, `archive-store.ts` for its SQL, which is tested on Node's own SQLite). The server is authoritative: it validates every move with the same engine from `shared/` and sends the new state to all players. Clients only send `{ move: {x, y} }`.

## Shapes and colours

The shapes are drawn by hand: [docs/reference/shapes.png](reference/shapes.png) has the first seven and [docs/reference/shapes-2.png](reference/shapes-2.png) repeats them and adds five more. Twelve shapes, each with its own marker colour (name and number are on the photos):

| Shape                         | Colour           |
| ----------------------------- | ---------------- |
| Cross (X)                     | vivid red 4      |
| Circle (O)                    | royal blue 70    |
| Square                        | grass green 47   |
| Diamond                       | ultramarine 73   |
| Star                          | WG8 (grey)       |
| Plus                          | vivid pink 6     |
| Asterisk, a cross with a line | ice blue 65      |
| Oval (ovaal)                  | viridian 54      |
| Heart (hart)                  | wine red 1       |
| Fort                          | prussian blue 69 |
| Waves (golven)                | orange 23        |
| Gold bar (goudstaaf)          | lemon yellow 35  |

The SVGs follow the hand-drawn lines, so they keep a slightly wobbly, hand-made look, with a line a little thicker than the marker's so that they hold up at small sizes. Twelve shapes means a game can have up to twelve players.

**Colours.** The colour belongs to the shape and is a design token (`src/styles/tokens.css`), with a lighter set for the dark theme. Telling twelve shapes apart at a glance, and being colourful, come before matching the markers exactly; but each colour stays in the _hue family_ of its marker (a window of degrees, in `src/styles/palette.test.ts`: red about 25°, royal blue 245°, grass green 145°, ultramarine 305°, pink 355°, ice blue 215°, viridian 165°, wine red 10°, prussian blue 275°, orange 55°, lemon yellow 95°, read from the photos). Within its window each colour was moved to be as far from all the others as possible, by a search (OKLab distance, also as seen with red-green colour blindness) under these rules: at least 3:1 against the page, at least 80% of the colour a screen can show at that lightness and hue (so no dull colours; the star is grey like its marker), and not neon. Where drawn colours are close (the three reds, the two greens, the three blues, orange and yellow) they are pulled apart by lightness and hue: the wine-red heart and the prussian-blue fort are the dark ones, the cross is a true red, the plus a magenta, the circle a bright blue, the asterisk a cyan. Yellow can't be bright and still have 3:1 on white, so the light theme's gold is as golden as the contrast allows. The test measures all of this, so a later change can't make two shapes look more alike: the smallest distance between two colours went from 6.5 to 10.4 in the light theme and from 4.7 to 8.5 in the dark theme, and under colour blindness from 1.4 to 5.6 and from 1.0 to 5.7.

The second drawing adds the oval, heart, fort, waves and gold bar; the person who drew them chose the Dutch names. Photos from a phone hold the place where they were taken, so only a copy without metadata goes in the repository (`.gitignore` keeps the original HEIC files out).

## Milestones

- **0 · Foundation:** project, CI, deploy.
- **1 · Playable 3×3:** the engine with tests, board and shapes, two players locally on one screen (to prove the engine and the UI).
- **2 · Online:** room server, create and join a room with a code, live moves, reconnecting.
- **3 · Big field:** configurable size and winning length, three or more players, choosing a shape, a field that grows with the game.
- **4 · History:** finished games are saved and can be watched again move by move, from a list of played games or a link. The engine already keeps the moves (milestone 1), so this builds on that.

## Open questions

- The rules of the big field (how it grows, how many in a row) and more than twelve shapes: for milestone 3, not needed yet.
