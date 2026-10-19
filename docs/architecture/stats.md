# Statistics

Read this before changing `shared/stats.ts`, the stats routes or the page Statistieken.
The decisions are in [docs/plan.md](../plan.md), Decisions, "Statistics (#48)".

## Server

- `GET /api/stats` answers the statistics of all finished games together (`Stats` in `shared/protocol.ts`).
- They are worked out from `ArchiveStore.all()` by `computeStats` (`shared/stats.ts`, pure) every time, never kept as counters.
- The answer holds only counts and shapes: never a name, a token or the moves of one game.
- The browser may cache it for 30 seconds.
- `GET /api/stats/mine` counts the games of one browser (`OwnStats`, from `ArchiveStore.ownGames` and `computeOwnStats`); token and caching as in [server.md](server.md).
- Days, weeks and hours are Dutch time (`Europe/Amsterdam`).
- Anything about duration leaves out games without a `startedAt`.
- The rooms made and the rounds of each come from the `rooms` table and the `room_id` of a game.
- A room gets its id when it is made (`room-id` in its storage) and hands it over with every game, never inside the stored game.
- Rooms and games from before the ids have none and are not counted as rooms.
- The time of every move is not kept.

## The page (`src/stats/`)

- `StatsPage` (`/statistieken`) asks `GET /api/stats` through `stats/api.ts` and shows cards: totals and weeks, how long games take, the shapes, whether starting wins, each kind of game with two heat maps (first moves, winning cells), when people play, the rooms and rematches, and a few fun ones.
- With fewer than three games (`MIN_GAMES`) it says "Nog te weinig spellen" instead of averages.
- The look paint is at the bottom of `Stats.css`, so a look file needn't change.
- The charts (`Charts.tsx`) are CSS bars and SVG heat maps with no chart library.
- Every chart says its numbers in text: a bar is a list item for screen readers, and a heat map names its busiest cells in words. Never only in colour.
- `stats/OwnStats.tsx` shows the browser's own numbers on the page of played games; it shows nothing while fetching, on a failure or without games.
