# Room server and archive

Read this before changing `server/`, `shared/protocol.ts` or how games are stored.
The decisions and their reasons are in [docs/plan.md](../plan.md), Decisions (rooms, archive, who may see a game).

## Rooms

- A room is a Durable Object (`server/room.ts`, SQLite storage, WebSocket Hibernation API).
- It only connects Cloudflare to code that can be tested without it.
- `room-logic.ts` holds the rules as functions on a `RoomState` of `{ round, seats, moves }`: the field and number of seats, who sits where, who may start, choosing a shape, whose move, rematch.
- A seat is `{ token, id, name?, shape? }`; the ids are `X`, `O`, `3`, `4`, … in the order of joining.
- The game is never stored in the room: it is rebuilt from the moves with the engine, with `roomConfig(round, shapes)`.
- `upgradeRoom` reads a room stored before shapes could be chosen.
- `room-session.ts` decides what happens when a socket says something or goes away, through a `Host` interface that the Durable Object implements and the tests fake.
- The server is authoritative: it validates every move with the engine and sends the new state to everyone.
- The Node tests use a stub for `cloudflare:workers` (`server/testing/`).
- The real Durable Object is tested end to end with two browsers (`e2e/online.spec.ts`).

## Routes (`server/index.ts`)

- `POST /api/rooms`: make a room; the body may carry the field and the number of seats.
- `GET /api/rooms/:code`: whether the room exists.
- `GET /api/rooms/:code/ws`: the WebSocket.
- `GET /api/games/:id`: a `StoredGame` for anyone who has the id.
- `GET /api/games`: the games of one browser, as `GameSummary`s, newest first, a page at a time.
- `GET /api/stats` and `GET /api/stats/mine`: see [stats.md](stats.md).
- The Worker also answers the pages of the app, see [pwa.md](pwa.md).
- The server stays language-free: errors and close reasons are codes, and the app has the words (`problem.*`).

## Messages (`shared/protocol.ts`)

- Every message is validated with the schemas in `shared/protocol.ts`.
- A client says `join` (optionally with the shape it had last time), `choose` (a shape, until the game starts), `start` (only the first seat, to begin with fewer people than seats), `move` or `rematch`.
- A server message is a full `state` snapshot or an `error` (only to the sender).
- The `state` says who sits where with which shape and how many `seats` the room has.
- Once every seat has a shape, the `state` also carries the config plus the moves, which the receiver replays.
- `gameId` in the `state` says where the game of a finished round is kept, and only once the archive has it.

## Tokens and privacy

- A token identifies a browser. It never leaves the server and is never in a stored game.
- Tokens are stored only as hashes (SHA-256) in the archive's table of who sat at what.
- A token travels in the `X-Player-Token` header, never in an address. Answers that depend on it are `private, no-store`.
- A game holds the moves and the typed names, never a token.

## The archive

- `server/archive.ts` is a second Durable Object class that holds every finished game; `archive-store.ts` is its SQL.
- `archive-store.test.ts` runs on `node:sqlite`, which is why `tsconfig.node.json` types that one test.
- When the move that wins or draws a round is played, the session gives the game an id (`game-id.ts`) and hands it to the `Host`.
- The game waits in a queue in the room's storage (`archive-queue.ts`, tested with a fake host) until the archive confirms it; the room's alarm tries again when that fails.
- A game that isn't finished is not kept. Stored games are never deleted.
- The room notes when the first move of a round was played (`startedAt`, from `Host.now()`); a `StoredGame` carries it next to `finishedAt`.
- `GET /api/games` finds the games through the hashed token; a page continues after the last game of the one before (`next`), so new games don't make it skip or repeat one.
- Which player a browser was in a game comes from `player_id` in the `players` table. `save` takes it from the position of the owner among the owners, so keep `Finished.owners` in the order of `players`.
