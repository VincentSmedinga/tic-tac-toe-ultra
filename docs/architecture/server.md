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
- `room-expiry.ts` is the rule for when a room is deleted (`mayGo`), tested without the Durable Object.
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
- A client may also say `leave`, once the round is over, see Leaving below.
- A server message is a full `state` snapshot or an `error` (only to the sender).
- The `state` says who sits where with which shape and how many `seats` the room has.
- Once every seat has a shape, the `state` also carries the config plus the moves, which the receiver replays.
- `gameId` in the `state` says where the game of a finished round is kept, and only once the archive has it.

## Leaving

- `leave` is accepted only when the round is over (or the room is damaged); during a round, before the game has started, and while choosing it answers `game-not-over`.
- A seat that leaves gets `left`: the number of the round it was in. The seat stays (its id, token and shape), so the ids of the other seats don't move and nobody else can sit in it.
- A seat counts in every round up to and including the one it left in (`playingSeats` in `room-logic.ts`) and in none after it. The round that was just played keeps all its players; the next one is played by the seats that are left.
- `finishedGame` takes its `players` and `owners` from `playingSeats`, so both skip the seats that left and stay in the same order.
- `stateFor` still lists a seat that left, with `left: true`, so the others can say who left; the one who left gets no more state.
- `join` with the token of a seat that left answers `left` (final). `move`, `choose`, `start`, `rematch` and a second `leave` from such a token answer `not-joined`.
- `rematch` with fewer than two seats left answers `room-over`.
- The session closes the sockets of the one who left with `CLOSE_LEFT` (4410), after the others have been told; the app goes to the start on that code.
- When nobody is left, the session calls `Host.remove()`: the Durable Object records it and sets its alarm for now, and the alarm deletes the room as soon as no game waits for the archive and no socket is open (`mayGo` in `room-expiry.ts`).
- Leaving never touches the archive: the game was kept when the round ended and stays in the games of everybody who played it.
- Tests: `room-logic.test.ts` (leaving after a round), `room-session.test.ts` (leaving the evening), `room-expiry.test.ts` and `e2e/online.spec.ts`.

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
