# Plan

## Goal

A game where many players play noughts and crosses together on one big field, each with their own shape. Version 1 is plain tic-tac-toe (3×3, two players, X and O), played online and live, each player on their own device. It is built so that a bigger field, more players, "k in a row" and more shapes are configuration and new drawings afterwards.

## Decisions

- **Online, live.** Players join a room and see each other's moves immediately.
- **Version 1 is classic 3×3 with two players**, but the engine is already written for N players, any field size and any winning length.
- **Games can be watched again.** A game is its config plus its moves, which the engine keeps; `replayGame` reads a stored game back and `stateAfter` steps through it. Saving the games and the replay screen are milestone 4; where games are kept and who may see them is decided in its first issue.
- **TypeScript, React and Vite on Cloudflare.** The same set-up as [Blokhut](https://github.com/VincentSmedinga/blokhut): pnpm, Node 24, Vitest, Playwright, Storybook, Cloudflare Pages, Conventional Commits, pull requests only. Realtime through Durable Objects.

## Architecture

- `shared/game/`: the game engine, pure TypeScript with no browser or Node APIs. `GameConfig { width, height, winLength, players[] }`, `applyMove(state, move)` with turn order for N players, and a win and draw check that only looks at the last move in four directions, so it also works on a big field. Version 1 uses `{3, 3, 3, [X, O]}`.
- `shared/protocol.ts`: the messages between client and server (zod), so both sides share the same types.
- `src/`: the React app: board, shapes, lobby. Shapes are a registry of SVG components; a player is assigned one, and the engine only knows a player id.
- `server/`: the room as a Cloudflare Durable Object with WebSocket. The server is authoritative: it validates every move with the same engine from `shared/` and sends the new state to all players. Clients only send `{ move: {x, y} }`.

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

The SVGs follow the hand-drawn lines, so they keep a slightly wobbly, hand-made look. The colour belongs to the shape and is a design token (`src/styles/tokens.css`), tuned for screens rather than copied from the photo. Orange and lemon yellow are too light for a white page, so the light theme has a darker orange and a gold. Twelve shapes means a game can have up to twelve players.

The second drawing adds the oval, heart, fort, waves and gold bar; the person who drew them chose the Dutch names. Photos from a phone hold the place where they were taken, so only a copy without metadata goes in the repository (`.gitignore` keeps the original HEIC files out).

## Milestones

- **0 · Foundation:** project, CI, deploy.
- **1 · Playable 3×3:** the engine with tests, board and shapes, two players locally on one screen (to prove the engine and the UI).
- **2 · Online:** room server, create and join a room with a code, live moves, reconnecting.
- **3 · Big field:** configurable size and winning length, three or more players, choosing a shape, a field that grows with the game.
- **4 · History:** finished games are saved and can be watched again move by move, from a list of played games or a link. The engine already keeps the moves (milestone 1), so this builds on that.

## Open questions

- The rules of the big field (how it grows, how many in a row) and more than twelve shapes: for milestone 3, not needed yet.
