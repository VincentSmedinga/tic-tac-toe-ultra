# Plan

## Goal

A game where many players play noughts and crosses together on one big field, each with their own shape: "Boter, Kaas en Eieren Ultra". It is played online and live, each player on their own device, in a room, or together on one screen. Version 1 was plain tic-tac-toe (3×3, two players); the field, the number in a row and the number of players (two to twelve) are chosen by whoever makes the game, and every player chooses one of the twelve shapes.

## Decisions

- **Online, live.** Players join a room and see each other's moves immediately.
- **Version 1 is classic 3×3 with two players**, but the engine is already written for N players, any field size and any winning length.
- **Games can be watched again.** A game is its config plus its moves, which the engine keeps; `replayGame` reads a stored game back and `stateAfter` steps through it. Saving the games and the replay screen are milestone 4.
- **Finished games are kept in an archive.** A second Durable Object class, `Archive` (SQLite storage, one object named `games`), holds every finished game of every room, so it outlives the room, which is deleted a day after its last move.
  It was chosen over D1 because it needs no database to create and no extra rights for the deploy token, and a pull request's preview Worker gets an archive of its own, like its rooms; one object holds about 10 GB, and a game is a few hundred bytes, so a family never gets near it.
  A game is saved by the room at the moment the move that wins or draws it is played, whoever is still connected, and once: the room gives it a random id (96 bits, 16 URL-safe characters, `/api/games/:id`) and puts the game in a queue in its own storage (`server/archive-queue.ts`), which survives a failed call, a sleeping room and a rematch: the room's alarm tries again every 30 seconds with the same id (20 times at most, then it is logged and dropped) and the room isn't deleted while a game waits.
  The players are told the id (`gameId` in the `state` message) only once the archive has confirmed the game, so a link never leads to a game that isn't there yet; the time kept is the moment the game ended.
  A stored game also says when it started (`startedAt`, the first move of the round, set by the room; with `finishedAt` it gives the duration; games kept before this have none and are left out of anything about duration, not guessed).
  A game that nobody finishes is **dropped**: it has no result, and the room that held it expires.
  Stored games are never deleted.
- **Who may see a game.** Anyone who has the id, and nobody who doesn't: the id is the link, and it can't be guessed.
  The repository is public but the games aren't.
  A game holds the shapes' moves and the names that were typed, never a token.
  The tokens of the players are kept only as SHA-256 hashes, in a table of their own, to find "your games" again (#17): a list is only for the browser that played, and there is no list of everybody's games.
  The list is `/spellen` (this browser's games, newest first, 20 at a time, the next page after the last game of the one before); a game is `/spel/<id>`, and a link to one that doesn't exist, or can't be read, says so. "Play again" from a game makes a new room for as long as every game is the classic 3×3 with two players; once the field and the shapes can be chosen, it should start a room with the same config.
- **Statistics (#48).** Decided with Vincent on 2026-10-18.
  **Whose:** both.
  The page Statistieken (`/statistieken`) shows the numbers of all finished games together, to anyone who opens it (it holds only counts and shapes: no names, no tokens, no moves of a single game), and the page of played games gets a few lines about the games of this browser, found through the hashed token like the list.
  **How they are kept:** worked out from the archive when asked, never as counters: `GET /api/stats` reads every stored game, `computeStats` (`shared/stats.ts`, pure, tested on a made-up set) counts, and a browser may keep the answer for 30 seconds.
  A family never plays enough games to make that slow, and the numbers are always right, since they can be rebuilt at any moment.
  **What counts:** finished games only; a game that nobody finishes is dropped, as it is now.
  **Your statistics:** `GET /api/stats/mine` (token in the `X-Player-Token` header, `private, no-store`) counts the games of this browser: played, won, lost and drawn, and the shape it played most, shown as a few lines above the list of played games (`OwnStats`, which shows nothing while fetching, on a failure or without games).
  To know whether a browser won, the `players` table keeps which player of the game each owner was (`player_id`, taken from the game's players, which are in the same order as its owners); rows from before have none, count as played, and not as won or lost.
  Days, weeks and hours are counted in Dutch time (`Europe/Amsterdam`).
  Anything about how long a game took leaves out games without `startedAt`; the players X and O of old games are read as the cross and the circle.
  The time of every move is **not** kept (so no thinking time per player, nor a fastest or slowest move); the rooms that were made and the rounds each had **are**: a room has an id of its own (`room-id` in its storage, since the code is used again once a room is gone), notes itself in the archive when it is made (`rooms` table: id, time, seats; a failed note only loses one count, the room still works), and every game it hands over carries that id in a `room_id` column next to the game and never in it, so a room's rounds are its games.
  Rooms and games from before this have no id and are not counted as rooms.
- **TypeScript, React and Vite on Cloudflare.** The same set-up as [Blokhut](https://github.com/VincentSmedinga/blokhut): pnpm, Node 24, Vitest, Playwright, Storybook, Cloudflare, Conventional Commits, pull requests only. Realtime through Durable Objects.
- **One Cloudflare Worker for the site and the rooms.** A Durable Object can't live in a Pages project, so the app is a Worker with static assets (`wrangler.jsonc`, `@cloudflare/vite-plugin`) and the rooms are Durable Objects in the same Worker; `pnpm dev` runs all of it in one Vite server.
  A pull request's preview is a Worker of its own (`tic-tac-toe-ultra-pr-<number>`, with its own rooms), deleted when the pull request closes, because Workers with Durable Objects get no version-URL previews.
  SQLite-backed Durable Objects run on the Workers Free plan; the WebSocket Hibernation API keeps an idle room free of duration charges.
- **Players can type an optional name.** It is kept in the room, not in an account; the shape is what identifies a player.
- **A room has two to twelve seats.** Whoever makes the room says how many (two when nobody says), together with the field (`players` in the body of `POST /api/rooms`, validated with the field).
  The first to join is the one who made it and holds the first seat; the seats are named `X`, `O`, `3`, `4`, … in order.
  The game starts by itself when every seat is taken and every person has chosen a shape, and the one who made the room can also start it earlier, with the people who are there, when there are at least two and all have chosen (`start` message, "Start met 3 spelers").
  From then on nobody new can sit down (`game-started`); the people who play stay for the rematches, with the seats that were left over staying empty.
  The turn order is the order of the seats, and every round the starting player moves one seat on.
  **When somebody doesn't come back the game waits for them**, as it does with two; a way to go on without them is for later.
  **The name is "Boter, Kaas en Eieren Ultra"** from here on, with capitals, as one title: "Ultra" is part of the name and not a label next to it, since it is what the game is once it can be played with many people on a bigger field.
  It is the title of the page, of the screen and of the README.
- **The field of a room is chosen by whoever makes it.** The room keeps it (`field` in its state, so a room that sleeps remembers it, and a room from before this is classic 3×3), `POST /api/rooms` takes it (`{ width, height, winLength }`, validated with zod; no body is classic), every `state` message tells it and a rematch keeps it.
  **Everything is odd**: sides 3 to 19, one side may differ from the other, and a row of 3, 5, 7 or 9 that is never longer than the longest side.
  The start screen offers three presets, **Klassiek** 3 × 3 with three in a row, **Groter** 7 × 7 with five and **Groot** 15 × 15 with five, and **Eigen veld** with a list of the odd numbers for width, height and row.
  The picker **suggests the row** that makes a good game (`suggestedRow` in `src/play/field.ts`): five in a row, the classic, as soon as the field is big enough (three on 3 × 3), seven on the biggest fields (17 and 19), following the smaller side; it follows the field while it is the row in use and keeps a row somebody chose.
  The game on one screen and "Speel opnieuw" from a played game choose and keep the field in the same way.
- **The app icon is the game's own drawing.** Four shapes, the cross and the circle on the top row, the fort and the square below, in the colours of the dark scheme (the set that has its contrast on a dark page) on the dark of the page (`#1b1b1f`), in the four cells of a grid of marker lines: one line down and one across and none around, as on the board (the first idea, a # with the shapes in its corner cells, cost too much room: a 2 × 2 keeps the shapes big).
  It is drawn from the paths of the shapes (`PATHS`), not next to them: `scripts/icons.ts` (`pnpm icons`) writes `public/icon.svg` and from it the pictures that browsers and phones ask for (`apple-touch-icon.png` 180 with the background right to the edges, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, the whole picture drawn at 67 % so that it fits the circle of the safe zone, 80 % of the square) with `@resvg/resvg-js`; the SVG itself is square and not rounded, a phone rounds it.
  In a browser tab the lines would be thinner than a pixel, so `favicon.svg` (and `favicon-32.png`) is a version for small sizes: bigger and bolder shapes, no lines, rounded. `scripts/icons.test.ts` keeps the files equal to what the script makes, the maskable icon inside the safe zone and the manifest's icons present at their sizes.
  The same picture is the logo to the left of the title on every screen (`Wordmark`, an `<img>` of `icon.svg`), as high as the two lines of the title, the heart of the old wordmark gone; it is the same dark square in every look and scheme, a look only gives it an edge so that it shows on a dark page. `public/manifest.webmanifest` (name "Boter, Kaas en Eieren Ultra", short name "Tic Tac Toe Ultra" (the name under the icon: "Ultra" alone told nothing next to other apps; iOS may shorten it, which is for the device check on #56), `display: standalone`, `start_url` and `scope` `/`, `lang: nl`, dark theme and background colour) and the tags in `index.html` (icons, manifest, `apple-mobile-web-app-*`, `viewport-fit=cover`) let a person add the game to a home screen, on an iPad or iPhone with "Deel" and "Zet op beginscherm" and on Android and desktop Chrome from the browser; the icons are kept for a day (fixed names), the manifest for an hour (`public/_headers`).
- **Installable, and what that asks of us (#56).** On an iPad and iPhone (Safari) nothing offers to install the game: a person taps "Deel" and "Zet op beginscherm", which works from the manifest, the `apple-touch-icon` and the `apple-mobile-web-app-*` tags.
  Chrome and Edge (Android and desktop) offer it themselves when there is a manifest with icons and a service worker, and we ask for it with a button of our own ("Installeer de app", from `beforeinstallprompt`).
  Both live on the settings page (`src/pwa/InstallHint.tsx`, the section "De app", which is left out where there is nothing to say): the button where the browser can install, and on iOS Safari outside the installed app the line "Tik op Deel en kies Zet op beginscherm." with "Niet meer tonen", which closes it for good (localStorage, with a fallback to memory).
  Other browsers on iOS, a Mac and the installed app show nothing.
- **The service worker is as small as it can be, and the game stays live.** It lives in `service-worker/worker.ts`, which is not served as it is: the build (`service-worker/build.ts`, a Vite plugin) writes `sw.js` next to the files of the app, with the list of the build's files in front of it and the types stripped, and names the cache `ultra-<hash of those files>`, so every build with other files is another worker and another cache (`pnpm dev` has no worker, and `src/main.tsx` registers it only in a build).
  It does three things.
  (1) It never touches `/api/*`, which carries the rooms, the games and the WebSocket: it doesn't answer those requests at all (no `respondWith`), so nothing live can come from a cache, and neither can any request that isn't a GET to our own address.
  (2) A screen (a navigation) is always fetched from the network, so no one opens a page that belongs to an older server; only when that fails the worker answers with `/offline.html`, "Geen verbinding" with a "Probeer opnieuw" that loads the same address again, in the icon's dark and the system's font, since it has to stand alone.
  We chose that over serving a cached shell because every screen but the game on one screen needs the server anyway, and a shell that comes from the cache is how a page of an old build meets a new server.
  (3) The files of the build (scripts, styles, fonts under `/assets/`, which have names that change with their content) are kept at install and answered from the cache, so a launch fetches little more than the page itself.
  A new worker takes over at once (`skipWaiting` and `clients.claim`) and deletes the caches of other builds; `src/pwa/register.ts` asks for a new worker whenever the app comes into sight, and loads the page again when a new worker has taken over and the app is out of sight (never on the game on one screen, which lives only in the page). `/sw.js` and `/offline.html` are served `no-cache` (`public/_headers`).
  Tests: `service-worker/worker.test.ts` runs the worker the build makes against a fake browser (never answers `/api/*` or a WebSocket, falls back to the offline page, a new version deletes the old caches), `src/pwa/*.test.tsx` the registration and the hint, `e2e/offline.spec.ts` the real thing in Chromium (the headers, taking over, rooms that are asked again).
  Playwright's offline mode stops a navigation before the worker sees it, so the offline page itself was seen once by hand: load the build from a server, stop the server, open another address.
  Chromium says the app is installable (`Page.getInstallabilityErrors` is empty); a Lighthouse run on the deployed pull request can say the same.
- **Standalone has no address bar and no back button.** Every screen has the menu (the four places, see Navigation below) or, on a phone while a game is on the screen, a way back to the start; a room's code and link can be copied, and "Terug naar het begin" goes to the start (the seat in the room stays, the start screen leads back to it; leaving for good is "Stoppen" after a game, see Leaving a game), so nothing needs the browser's chrome.
  Navigation is `history.pushState`, so the swipe back of an iPad or iPhone goes back through the game's own screens.
  A room's connection tries again at once when the page becomes visible or the network returns, and a page that iOS threw out of memory loads again and joins with its token.
  One thing to know: an installed app on iOS has its own storage, apart from Safari's, so it is another browser to the room (another token, name and last room); someone who made a room in Safari and opens the installed app joins it with the code or the link like anyone else.
  The full screen mode (#55, see Full screen below) is there in an installed app too: the app has no browser chrome, but the mode still takes the title and the menu away and gives the board all the room.
- **A link has a face (#56).** A room link or a game link shown in a chat has a picture, `public/og-image.png` (1200 × 630: the icon on the left, the title "Boter, Kaas en Eieren Ultra" in Patrick Hand, the font of the Getekend look, on the dark of the page), made by `scripts/icons.ts` with the icons, and a title and description in `og:` and `twitter:` tags in `index.html`.
  A chat needs the _absolute_ address of the picture, which is different for a preview of a pull request, production and the domain of its own that #36 decides on.
  The build is made once and deployed to all of them, and the address of a deploy is only known after the deploy, so it isn't in the build: the Worker answers the pages of the app and puts the origin of the request in front of the picture (`server/page.ts`; the files of the build, `/assets/*` and the icons, never wake the Worker).
  So the address is right everywhere and after #36 without a change.
  Chosen over a build step per deploy (the build is shared) and over waiting for #36.
  The cost: a request for a page now runs the Worker (a few milliseconds; the free plan's 100,000 requests a day is far away for a family game), and a new address of the router has to be added to `PAGE_PATHS` and `run_worker_first` too (`scripts/page-config.test.ts` fails otherwise).
  Every address that is not a page is a file, and a page of an address the router doesn't know shows the start screen with a relative picture address, which no chat asks for.
  No `apple-touch-startup-image`: iOS makes its own splash from the icon and the dark background colour, and a picture of its own is only for when that turns out ugly on the iPad.
- **The board is a grid of lines, not a field of boxes.** The # of tic-tac-toe: a line _between_ every two columns and every two rows and none around the field (a 3×3 has two lines across and two down), so the field has no edge to fall off, which also suits the bigger fields and the field that grows (#44).
  The cells have no border, radius or gap and touch each other; the whole cell up to the line is the tap target.
  The lines are one SVG behind the cells (`Board.tsx`, `lines.ts`), in units of one cell, with the pen at a constant width (`vector-effect: non-scaling-stroke`), so nothing moves when a cell gets a shape.
  Every line is in the SVG twice, straight and as a hand draws it (a little crooked, started and stopped a little off, a different weight from line to line, the same every time), and the look shows the one it draws with: **Getekend** by hand in the ink (4 px on a small field, down to 2 px from about 7 columns), **Speels** thick and round in the colour of the edge (6 px, down to 3 px; in the dark scheme the edge is black like the page, so it takes the line token), **Rustig** thin and straight (2 px) in the line token.
  Lines are `--line` or darker, which has 3:1 against the page.
  The shapes are always on `--page` (their contrast is tested against it), so the field is a surface of that colour, half a rem round the grid and without an edge, over whatever is behind it (a wallpaper, a sky).
  A cell is no box any more, so what marks it is drawn on a patch inside it (a rounded square a little smaller than the cell, so it keeps away from the lines; the tap target is still the whole cell): the cell you can play gets a tint under the pointer or a finger (a taken cell never does), the move just played in a replay a tint and a thin ring, the keyboard's cell the focus ring, and every cell of a winning line an orange-yellow background (the win colour at half strength over the page, so the shape on it keeps its contrast; cells of several lines at once are all marked, a corner once, and the cells of a line touch, so a win is one band).
  That a winning cell is told apart by its patch and not by colour alone rests on the band's shape; the replay's thin ring says which move won.
  Dense mode (thin lines and small gaps from five columns) is gone with the gaps.
- **A field that doesn't fit the screen is scrolled inside its frame.** A cell is never smaller than 2.75 rem (44 px, a finger), so a field of seven columns just fits on a phone (the cells touch, there is no gap to lose), and a bigger one is scrolled in its frame, in both directions, starting in the middle; the page itself never scrolls sideways.
  For the keyboard the board is one tab stop, as a grid is: Tab goes in and out, the arrow keys, Home and End move over the cells (a field of 19 × 19 would be 361 stops otherwise).
  Zooming and a view that follows the action are for #44, where the field grows.
- **Players choose their shape.** The shape _is_ the player: the engine's player id, the `player` of a move and a stored game's players are the shape's id (`cross`, `heart`, …; the ids are in `shared/shapes.ts`).
  A room has seats (`X`, `O`, in the order of joining) and a shape per seat; the seat is only how the room knows who is who.
  A player chooses while waiting for the other one, or after joining (`choose` message, validated in the room: the shape must exist and be free); a join may carry the shape this browser had last time (kept in localStorage), which the room takes when it is free, so nothing has to be chosen twice.
  The game starts when every seat has a shape, and **the room waits for as long as it takes**: there is no default, because someone who is there can choose.
  From then on **the shapes are fixed for the evening**: a rematch keeps them, and another shape means another room (a choice between rounds would need a pause after every game; it can come later).
  In a game on one screen each player chooses too, with the cross and the circle ready, and "Andere vormen" after a game goes back to choosing.
  Games that were stored (or rooms in progress) before this, with the players X and O, are read as the cross and the circle.

## Architecture

- `shared/game/`: the game engine, pure TypeScript with no browser or Node APIs. `GameConfig { width, height, winLength, players[] }`, `applyMove(state, move)` with turn order for N players, and a win and draw check that only looks at the last move in four directions, so it also works on a big field. Version 1 uses `{3, 3, 3, [shape, shape]}`, the shapes the two players have chosen.
- `shared/protocol.ts`: the messages between client and server (zod), so both sides share the same types.
  A message from a player is `join` (with a token that is kept in the browser, and an optional name), `move` or `rematch`; the server answers every change with the whole room as a `state` (config plus moves; the receiver rebuilds the game with the engine) and tells only the sender about an `error`. `shared/room.ts` has the players of a room, the game of each round and the room codes: four consonants, so they never spell a word.
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

**Colours.** The colour belongs to the shape and is a design token (`src/styles/tokens.css`), with a lighter set for the dark theme.
Telling twelve shapes apart at a glance, and being colourful, come before matching the markers exactly; but each colour stays in the _hue family_ of its marker (a window of degrees, in `src/styles/palette.test.ts`: red about 25°, royal blue 245°, grass green 145°, ultramarine 305°, pink 355°, ice blue 215°, viridian 165°, wine red 10°, prussian blue 275°, orange 55°, lemon yellow 95°, read from the photos).
Within its window each colour was moved to be as far from all the others as possible, by a search (OKLab distance, also as seen with red-green colour blindness) under these rules: at least 3:1 against the page, at least 80% of the colour a screen can show at that lightness and hue (so no dull colours; the star is grey like its marker), and not neon.
Where drawn colours are close (the three reds, the two greens, the three blues, orange and yellow) they are pulled apart by lightness and hue: the wine-red heart and the prussian-blue fort are the dark ones, the cross is a true red, the plus a magenta, the circle a bright blue, the asterisk a cyan.
Yellow can't be bright and still have 3:1 on white, so the light theme's gold is as golden as the contrast allows.
The test measures all of this, so a later change can't make two shapes look more alike: the smallest distance between two colours went from 6.5 to 10.4 in the light theme and from 4.7 to 8.5 in the dark theme, and under colour blindness from 1.4 to 5.6 and from 1.0 to 5.7.

The second drawing adds the oval, heart, fort, waves and gold bar; the person who drew them chose the Dutch names. Photos from a phone hold the place where they were taken, so only a copy without metadata goes in the repository (`.gitignore` keeps the original HEIC files out).

## Look and feel

Everybody chooses how the game looks, for themselves and per device (localStorage; the choices are on the settings page, see Navigation below; before that they were in a footer after every screen, because a button in a corner that floats over the screen covered what people needed).
The gallery of all the shapes ("Alle vormen") is no longer part of the game: it is in the style guide (see Style guide below).
Two choices, both applied before the first paint by `public/appearance.js` (so nothing flashes) and kept up to date by `src/appearance/`:

- **The theme, one of three looks** (`data-look` on `<html>`, `src/styles/look-*.css`).
  All three dress the same screens and share one layer (`look-shared.css`): everything centred, a fluid type scale, a board as big as the room that is left (width and height), screens that slide (a view transition, off for people who want less motion), and the shapes always on `--page` so their tested contrast holds.
  **Getekend** (the first) is warm: paper, marker lines that are a little crooked, a highlighter under the headings (Patrick Hand).
  **Speels** is bright: a colourful sky, big cards with a thick edge and a hard shadow, buttons that go down when pressed (Fredoka).
  **Rustig** is calm: big type, no frames, one big button, almost no wallpaper (the system's rounded font).
  The decision was to keep all three and let people choose, rather than to pick one; the fonts are under the SIL Open Font License, come from the site itself and are fetched only by the look that uses them.
- **Light or dark** (`data-scheme`): it follows the system until a person picks one, and has two buttons, Licht and Donker, never a "Systeem" (the model of [Blokhut](https://github.com/VincentSmedinga/blokhut) and of Lea Verou's [two states are enough](https://lea.verou.me/blog/2026/dark-mode-toggles-two-states-are-enough/)): a pick that is what the system gives anyway is forgotten, so the system is never out of reach.
  The browser's bar takes the colour of the page (`--chrome`, which a look may set itself).
  **The top and the bottom of the screen on an iPhone** (issue #77): iOS 26 and later draw a bar of their own behind the status bar and Safari's toolbar, as a solid extension of the page with a soft fade at its edge, next to a fixed or sticky element near the edge (WebKit's explanation, [bug 301756](https://bugs.webkit.org/show_bug.cgi?id=301756); others see the same, e.g. [fanta-f1#59](https://github.com/Lorenzogallone/fanta-f1/pull/59)), and nothing in CSS or a meta tag turns it off.
  The wallpaper was a fixed layer over the whole screen, so the game got that bar: a plain band over the wallpaper at the top and bottom, and a fade over the logo and the title.
  (A first try covered the status bar with a fixed strip of its own: it was the same kind of element, showed as a band, and did nothing in Safari, where the bar is the system's.) So **nothing of the page is fixed to the screen's edges**: the wallpaper is absolute in the `body`, as high as the page, and scrolls with it, so it runs under the bars like the rest of the content; the layer of the play mode is fixed by design, with a wallpaper of its own. `.app` starts its content a margin _below_ the inset (`calc(1rem + inset)`, not `max`) and has `calc(2.5rem + inset)` under the footer, so the footer isn't pressed against the edge of the device.
  This was found with a screen recording from an iPhone (no simulator was available), and the first check on a phone, in Safari and in the installed app, is that the wallpaper runs under both bars and the logo and the title are whole.

The wallpaper (the twelve shapes scattered over the page, drawn from the same paths) is a component whose loudness is a token of the look.

## Navigation

Issue #81: with the games played, the statistics, three languages, the full screen mode and the install hint, the game was hard to find your way around: most of it was in a footer about 470 px tall on a phone, and the start screen was five cards. Decided on 2026-10-19, after Vincent compared three patterns in drawings (a bottom bar, a menu at the top, a hamburger).

- **Four places: Start, Spellen, Statistieken, Instellingen** (English Home, Games, Stats, Settings; Frisian Begjin, Spultsjes, Statistiken, Ynstellingen). The labels are short so that they fit a quarter of a phone (the longest, "Statistieken" and "Ynstellingen", are 12 letters); the full title stays on the page ("Gespeelde spellen"). A visible label is the accessible name.
- **On a phone a bar of tabs, from 48 rem a row under the title.** Four equal places you move between all day are what a tab bar is for, it is where a thumb is, and it is the way home in an installed app, which has no back button. A hamburger hides the places (two taps, the top corner is the hardest to reach, and a drawer is the most to build and test); a menu at the top is out of reach one-handed and its labels wrap.
- **The bar is part of the page, at the end of it, and not fixed to the bottom of the screen.** iOS 26 draws a bar of its own behind an element that is fixed or sticky near the edge (see Look and feel, issue #77), and the rule since is that nothing of the page is fixed. On a short screen (the start, with its few cards) the bar is at the bottom of the window; on a long one (the settings, a long list of games) it is at the end of the page and you scroll to it. Making it stick is one CSS line (`position: sticky; bottom: 0` on `.main-nav`) and `MainNav.test.tsx` and `top-edge.test.ts` would change with it; it needs trying on an iPhone, in Safari and in the installed app, first.
- **A game on a phone has no bar.** The board keeps all its room, and the header gives way to a "‹ Terug naar het begin" link (the title stays for screen readers). A room is not lost by leaving it: the start screen offers the way back. From 48 rem the row stays in a game, there is room.
- **The settings page (`/instellingen`) holds what was in the footer:** Uiterlijk (Thema, Licht of donker, Animaties), Taal, the name ("Wie ben je?"), "De app" (the install hint, only where it applies) and "Over" (what the game is, the version, the fonts, a link to the code). Each is kept per device and applied at once.
- **There is no footer.** What it held is the menu or the settings page.
- **The start screen is about one thing.** A big "Nieuwe kamer" makes a room with what the last one was made with (two players, 3 × 3 the first time); the line under it, "2 spelers · 3 × 3, drie op een rij · Aanpassen", opens the number of players and the field picker where they stand. Joining with a code is one row, "Samen op één scherm" is a second button, and the name lives on the settings page, with a line at the end of the start screen ("Je speelt als …", or "Voeg je naam toe") that links there. The room you are still in comes first, as before.
- **Later:** "Dit apparaat vergeten" on the settings page (it would also lose the list of played games, so it needs a warning).

## Leaving a game

Issue #88. Before it, a room could not be left: closing the page or going to the start only dropped the connection, so the others saw "even weg… wacht op terugkomst" for ever and the leaver's start screen kept offering the room. Decided with Vincent on 2026-10-19; the proposals of the issue were accepted.

- **A real `leave` message, for good, once the round is over.** During a round, before the game or while choosing it is refused (`game-not-over`): a missing player would stop the turns. Closing the page or "Terug naar het begin" stay what they were: the seat is reserved for a person who is only away.
- **The seat is marked, not removed.** `left` holds the round the person was in. The ids of the other seats don't move (`seatId` is the position), the seat still counts against the number of seats so nobody else can take it, and the finished round keeps all its players. Taking over a seat that was left is for later.
- **The others carry on with two or more.** The next round is played by the seats that are left, on the same field, and who starts is `round % shapes.length` of those; with fewer than two the room is over: no rematch (`room-over`), the replay and the way out only.
- **The person who left cannot come back.** The same token gets `left` ("Je hebt dit spel verlaten"), so that "Stoppen" means something to the people who stay.
- **A room nobody is in is deleted at once**, as soon as no game waits for the archive and no socket is open; a room in which somebody is left lives its 24 hours as before. The code is free again.
- **Leaving forgets the room on this device** (`clearLastRoom`), and only this way: the header link and the menu keep the offer on the start screen.
- **A question first in a room, none on one screen.** Leaving is for good and the button sits next to "Nog een keer"; "Blijven" has the focus. On `/samen` nothing is kept anywhere, so "Stoppen" goes to the start.
- **No leaving without a connection.** The button is disabled while the connection isn't open; there is no local-only "leave" that would promise a freed seat it can't deliver.
- **The game stays.** The archive is not touched: a game is kept when its round ends, with the tokens of everyone who played it, and stays in their lists.
- **The words:** Stoppen (nl), Leave (en), Ophâlde (fy), and "{names} heeft/hebben het spel verlaten." in place of "even weg" for a seat that left.

## Style guide

The people who make the game need to see its design in one place: all the shapes (and every pair that can play against each other), the tokens, the three looks in light and dark, and the parts of the game in each of their states. It is not for the people who play, so it is **not part of the game's build**. Run it with `pnpm storybook`.

- **Decision: Storybook, not a page of our own.** The same tool as [Blokhut](https://github.com/VincentSmedinga/blokhut), so there is one way of working for both projects.
  A static page would have meant writing a toolbar, a viewport switch and an accessibility check ourselves; Storybook has them (the `viewport` toolbar for a phone and a tablet, the accessibility addon for each story).
  The price is dependency weight: `storybook`, `@storybook/react-vite`, `@storybook/addon-a11y` and its ESLint plugin, all `devDependencies`, so `pnpm install` is a little slower and nothing else changes: Storybook has a config of its own (`.storybook/`, with a Vite config without the Cloudflare plugin), so `pnpm dev` and `pnpm build` of the game are untouched.
  We checked: the game's `dist/client` is byte for byte the same with and without it, and CI checks that `dist` holds no Storybook.
- **Not in the game's build.** The stories (`*.stories.tsx`) sit next to the part they show and nothing in the game imports one; Vite only bundles what the entry point imports. The foundation pages that belong to no part (the shapes, the tokens, the buttons and cards) are in `src/styleguide/`.
- **The real mechanism.** The two switches in the toolbar, Thema and Licht of donker, set `data-look` and `data-scheme` on `<html>` with the game's own `applyLook` and `applyScheme`, so the looks are the ones of the game (`src/styles.css`), not a copy.
  The settings story has the game's real controls, which change the same two attributes: the toolbar follows them.
  The tokens page reads `tokens.css` (the colours of both schemes, with their contrast against the page, the same way the tests read them) and the custom properties of the page as the look has them, so a new token shows up by itself.
- **CI.** A `Style guide` job builds it (`pnpm build-storybook`) on every pull request and push to `main`, in parallel with `Checks` (about a minute), and deploys it, as Blokhut does with its Storybook, to an address of its own: a Worker with static assets and no code (`.storybook/wrangler.jsonc`), `tic-tac-toe-ultra-styleguide` for `main` and `tic-tac-toe-ultra-styleguide-pr-<number>` for a ready pull request (CI comments the address; `preview-cleanup.yml` deletes it when the pull request closes).
  It sends `noindex` and none of the game's Content-Security-Policy (`.storybook/public/_headers`), it holds nothing private, and it uses the same Cloudflare token and secrets as the game.
  A draft and a fork only build it.
  It is not in the ruleset yet: add `Style guide` to it by name to make it a condition for merging.

## Animations

The ideas are in issue #31 (the list to choose from with the person who drew the shapes); each one that is picked gets a pull request of its own. The first: **a shape is written, as with a marker, when it is placed** (the person who drew the shapes asked for this one first).

- **One module picks, another plays.** `src/motion/arrival.ts` is pure: from a seed, the number of the move and the number of strokes of the shape it makes a plan (a variant, and per stroke the order, direction, delay and duration).
  The variant of a move is chosen from all variants except that of the move before, and the details are random within ranges, so the same two moves are never written the same way, and the whole chain is a function of the seed: the same seed gives the same game, which is what a test needs and what lets the replay (#16) later write a game as it was written live (the seed would be the game's id). `play.ts` plays a plan with the Web Animations API. No animation library.
- **Only strokes and opacity.** Writing animates `stroke-dashoffset` (the paths have `pathLength="1"`, so a dash of 1 is the whole stroke) and `opacity` of the shape's own paths; nothing changes a size or a position, so it can't repeat the Safari bug of #21. The finished shape is the element's normal style: the animation only hides what is not written yet (`fill: backwards`), so when it ends, or is cancelled, the whole shape is there. That is also how it is cut short.
- **Never holds the game up.** The state has the move at once; the animation lives in the shape's effect. `Board` keeps the plan of every shape that arrived, and the next move does not touch the ones before: a shape that is still being written finishes while the next one is placed.
  This was chosen over cutting it short (the first idea of #31 and the first version of this pull request) because in a replay on fast, a step every 0.3 seconds cut each shape off before it was done; at most a few shapes are being written at once (a shape takes at most a second).
  A shape that leaves the field (a rematch, the replay stepping back) takes its plan, and so its animation, with it.
  A board that is first shown with moves on it, or that jumps over several moves at once (the replay's slider), writes nothing.
- **One time for every shape.** Writing takes 0.8 to 1 second for every shape (steady 0.85–0.95, hasty 0.8–0.9, deliberate 0.9–1.0), however many strokes it has and however long they are.
  The time is picked first and shared out over the strokes by their length (`shapes/length.ts` measures the paths, to the same values as a browser's `getTotalLength`), so every stroke is drawn at one speed, give or take a little hand.
  Before this, each stroke took about 0.35 seconds, so the long fort was much faster than the star.
  The variants differ in how that time is spent: back to back, with the next stroke starting before the last is done, or with pauses.
- **The win colour waits.** The orange patches of a won game used to be there at the first moment of the move, while the winning shape was still being written. When the move that wins was just placed, `Board` gives the patches `data-win-late` and `--win-delay` (the end of the writing), and they fade in over 0.3 seconds then (opacity only). A game first shown won, a replay jumping to the end and switched-off animations show them at once; with less motion asked for they follow a 0.2 second fade.
- **The replay has one speed.** The choice of three speeds (1.6, 0.8 and 0.3 seconds a step) is gone: a step every 1.2 seconds (`STEP_MS`) lets each shape, which takes 0.8 to 1 second, be written and rest a moment before the next. Slower would drag, faster would cut the writing off or pile shapes up.
- **Less motion.** `prefers-reduced-motion` makes the shape fade in (200 ms) instead of being written, and the switch Animaties (Aan, Uit) on the settings page, kept per device, turns every animation off, also for people whose system doesn't ask. Nothing flashes: a shape is written once, over at most a second.
- **Variants of writing so far:** steady (one stroke after the other), hasty (the next stroke starts before the last is done) and deliberate (slower, with a pause between strokes). The stroke order and the direction of each stroke are random. Later ideas of #31 add their own variants next to these.
- **Closed shapes go round, one way or the other.** Starting a circle, an oval or a diamond halfway round the line looked odd (tried in #73 and taken out again), so each of them is one line that is written from one end to the other, with the clock or against it (the plan's `reverse`, 50/50).
  The square is four strokes that follow each other, so the plan goes round it like a hand does: from any of its four sides, one way or the other, every stroke in that direction, which makes eight ways to start (`isRing` in `src/shapes/closure.ts` says which shapes are rings; the choice has a generator of its own, so the rhythm and jitter of the plan are what they were).
  The shapes' drawings and the dash on them are not touched.
- **Decisions for now:** surprises stay small (everything within the cell, at most a second), and no sound.

## Full screen

Issue #55: while playing, a player can give the whole screen to the field: no title, no menu, no wallpaper, nothing but the board, who is to play, the players and the way out. On a phone that is the difference between a field of 7 × 7 that just fits and one that is comfortable, and on a big field it gives the scrolling frame all the room there is. Decided on 2026-10-19.

- **Two layers, and nothing pretended.** (1) A **play mode of our own**: the section that holds the game (`.game`, in the game on one screen and in a room) gets `data-play-mode` and becomes a layer over the page (`position: fixed; inset: 0`, the page colour, safe-area insets for the notch and the home bar).
  It is the same on every device.
  (2) On top of it the real **Fullscreen API** (`layer.requestFullscreen()`, in the tap itself) where `document.fullscreenEnabled` is true: desktop browsers, Android and iPadOS. An iPhone has it for video only, so there the mode is the layer alone and the address bar and tabs of Safari stay; the button doesn't change its label or say "full screen" any differently there.
  A refused request leaves the layer as it is.
  The browser's own Escape ends the real full screen and, through `fullscreenchange`, the mode with it, so there is one thing to leave, not two.
- **What stays on the screen:** the status line with the shape of whoever is to play, the players in a row (small, the one to play underlined and bold: `data-turn`, not only a colour; in the game on one screen the row is only there in the mode, because the status line is all it has otherwise), the connection notice of a room (it moved into the game: `OnlineGame` takes it as `banner`, so it is not left behind the layer), and the button "Sluiten".
  The field label ("3 × 3, drie op een rij") is left out.
  When the game is over the actions come back on the screen, in the mode ("Nog een keer", and "Andere vormen" in the game on one screen), because the next round is what the players want. "Kijk terug" and "Andere vormen" end the mode: the replay and the shape picker are screens of their own (the replay in the mode is a candidate for later).
- **Who has it:** whoever wants it, on their own device, in the game on one screen and in a room. It is never put on anybody and it is not shared: the room doesn't know (a test checks that nothing is sent). **Not remembered:** it is a choice for this game, with a button that is easy to find each time (48 px, next to the field).
- **The button** "Volledig scherm" (`playMode.open`) turns into "Sluiten" (`playMode.close`) with `aria-pressed` and `aria-keyshortcuts="F"`, an icon of four corners going out or in.
  Its accessible name is its visible text, which is why the text changes with the pressed state: a name that stays "Volledig scherm" while the button says "Sluiten" is a mismatch for voice control (WCAG 2.5.3), and "Sluiten, ingedrukt" says the state without a second sentence.
  **F** on the board does the same (not with a modifier, not on a key repeat, not when the focus is elsewhere, so typing in a field never triggers it).
  Both are offered in an installed app too.
  They were first left out there, on the reasoning that an installed app has no browser chrome to hide; but the title and the menu are still in the way of the board, and on an iPhone the home-screen app is where the game is played.
  The layer is the same there, and the real Fullscreen API is asked for wherever `document.fullscreenEnabled` allows it (an installed app on an iPhone has none).
- **A state in the history.** Opening pushes an entry with the same address and `{ playMode: true }`, so back closes the mode and not the game (the swipe back of an iPad or iPhone too).
  Closing with the button, Escape or F goes back through the same entry, so the history is as it was.
  When the game screen goes away while the mode is on (a lost room, "Andere vormen") its cleanup goes back as well; a screen that was left through a link has left the entry behind, which costs one extra back and nothing else (the menu, with those links, is out of reach in the mode anyway).
- **The page behind.** While the mode is on, everything on the page that is not the layer and does not hold it is `inert` (`setAttribute('inert')` on the siblings of the layer and of each of its ancestors, up to `body`, and put back afterwards, leaving alone what was inert already): out of the tab order, out of reach of a pointer and hidden from screen readers, so nobody tabs to a link they can't see. `html[data-play-mode]` locks the page (`overflow: hidden`, `overscroll-behavior: none`) and the layer's own scrolling is only the board's frame.
  Everything is given back when the mode ends, also when the game screen unmounts in the middle.
- **Focus.** On opening the focus goes to the board, to the cell the keyboard was on (the board's one tab stop), unless it was on the board already (F on a cell keeps it there); scrolling for the focus is off, because the frame is put in the middle afterwards. On closing the focus goes back to the button.
- **How big the board is, and the cut-off.** The frame (`.board-frame`) takes all the room the grid gives it (a container of its own size, `container-type: size`) and the board is `max(min(100cqw, 100cqh × columns ÷ rows), columns × --cell-min)` wide: the biggest board that fits both the width and the height, so the cells stay square and a field that fits is **wholly in view without scrolling**.
  The cut-off is the same minimum as outside the mode, **`--cell-min`: 2.75 rem, 44 px**, the size of a finger (and of Apple's guideline).
  A field with more cells than fit at that size keeps the cells at 44 px and scrolls inside its frame in both directions, starting in the middle (again whenever the mode starts or ends); the page itself never scrolls.
  In numbers: 3 × 3 and 7 × 7 (308 px) fit on any phone in portrait; 9 × 9 fits from 396 px; 15 × 15 (660 px) and 19 × 19 (836 px) scroll on a phone in either direction; an iPad in portrait (768 px wide) shows 17 columns, and in landscape about 16 rows, so 15 × 15 fits there and 19 × 19 scrolls a little.
  Smaller cells for a big field on a phone would make every tap a guess, and a zoom of our own would bring a second kind of scrolling; both were left out.
  The field is not capped at `--board-max` in the mode: all the room is what it is for.
- **Orientation.** The layer is a grid: in portrait the bar (status, button, players) on top, the field under it, the actions at the bottom; in landscape (`orientation: landscape`) the field on the left with the whole height and the bar, the players (a column) and the actions on the right (11 to 16 rem).
  It is CSS only, so turning the phone changes the layout and nothing else: no state is lost.
  Nothing in the mode resizes a cell or moves the board while a shape is written (the animations use transforms, opacity and strokes only, and the board's size comes from the frame, never from what is in a cell), so the Safari bug of #21 can't come back.
- **The three looks, light and dark.** The layer paints the theme itself: the look's backdrop (and the paper grain of Getekend) as its own background and a `Wallpaper` of its own as its first child.
  It can't rely on the page behind it: in the browser's real full screen the layer is in the top layer, the page is not drawn at all and the browser puts black behind it (that was the first version: black in every theme).
  What has to be read sits on a **see-through surface**: the field and the row of players are the page colour at 62 % (`--board-surface`, from `--board-opacity`) with what is behind them blurred (`backdrop-filter: blur(var(--board-blur))`, 6 px); Getekend has a faint wallpaper on paper, so it lets more through, 45 % and 2 px (a first try with the same 62 % made the field look like a flat slab on desktop Safari, where the dark paper hides most of the wallpaper), and a look sets the two variables, so the theme shows through as a soft wash of colour and the wallpaper's crisp shapes don't compete with the shapes of the game; the shapes keep the contrast they were tested for because the page colour stays the main part and the blur takes the detail away.
  The same surface is the field's in the page (it was an opaque black slab on a bright backdrop, `.board::before`, a little way round the grid).
  The status line and the button keep the look's own paint (the pill of Speels, the pen of Getekend, the large type of Rustig), with their size taken down to fit a bar.
  The looks needn't change: `PlayMode.css` sits above them for the layout.
- **Screen Wake Lock.** Where the browser has `navigator.wakeLock`, the mode asks for a `screen` lock while it is on (and again when the page comes back from hidden, where the browser let go of it) and releases it when it ends, so a long game doesn't go dark in somebody's hand. Where there is none, nothing happens and nothing is said.
- **Not a keyboard trap.** Escape always works; the one tab stop of the board, the button and the actions are all that is in the tab order.
- **What is checked, and where.** `src/play/playMode.test.tsx` (opening and closing with the button, Escape, the back button and F, the history, `inert` while it is on and not afterwards, focus in and out, the real Fullscreen API and the wake lock with fakes, an installed app (the mode is there too), the end of the game, the replay, English and Frisian), `src/online/OnlineGame.test.tsx` (the room's banner, whose turn it is, nothing sent), `e2e/play-mode.spec.ts` (two browsers, one in the mode and one not, back leaving the mode and not the game, F and Escape, a 15 × 15 field scrolling in its frame at 44 px cells, the real full screen in Chromium) and the stories "Volledig scherm" in the style guide.
  Not checked by a machine: how it looks in Safari on an iPhone (no Fullscreen API) and in Chrome on a phone and a desktop; that is for the pull request to say.

## Scrolling between screens

Issue #76: a new screen opened scrolled down. The page is long on a phone (the footer, the shape picker), a button at the bottom of one view (Start) led to a shorter one (the board), and the browser kept the page where it was, which is now the foot of the page with half of the board. Decided on 2026-10-19, in `src/online/scroll.ts`, once for every screen:

- **A new screen starts at the top**: `navigate()` scrolls to the top after the new screen is on, in the view transition too. A new **view** of a screen starts at the top as well (the picker that becomes the board, the lobby that becomes the game, a game and its replay): they share an address, so the router doesn't see them, and each such view says so with `useScrollToTop(view)`. Nothing else moves the page: not a move, a message, a rematch or a lost connection.
- **Back puts the page back.** The app takes `history.scrollRestoration` into its own hands (`manual`), because the browser restores the place before the screen is drawn (and before a fetched list has its height) and lands halfway.
  Every history entry gets an id in its state; the place of the page is remembered per id (in memory: a reload starts at the top) and put back after the screen is drawn, again as a screen that is still growing gets taller, until the person scrolls themselves or 1.5 seconds have gone by.
  Forward does the same.
  The entry of the full screen mode (no id) is not a screen and is left alone.
- **What is checked:** `src/online/scroll.test.tsx`, a test in `RoomPage.test.tsx` and `e2e/scroll.spec.ts` (a phone: Start shows the board from its top, a link goes to the top, back returns to the place).

## Languages

The game is offered in Dutch (the first language, and the one that is written first), English and Frisian (issue #50). More languages (German, French, Spanish, Portuguese, Arabic, Turkish, Hindi, Mandarin and Japanese) are issue #71, which builds on this; nothing here stands in its way. Decided on 2026-10-18; the questions that are Vincent's to answer are listed in the pull request and are marked **unreviewed** where they matter.

- **A dictionary of our own, no library.** `src/i18n/` has one typed object per language (`nl.ts`, `en.ts`, `fy.ts`), a hook `useText()` that gives a function `t(key, values)`, and no dependency. i18next, Lingui and FormatJS were looked at and left out: the app has about 270 texts, no rich formatting beyond plural and a list, and everything a library would add (message extraction, ICU parsing, a runtime of 10 to 40 kB) is something the browser already does (`Intl.PluralRules`, `Intl.ListFormat`, `Intl.DateTimeFormat`, `Intl.NumberFormat`).
  The price is that we write the plural and placeholder handling ourselves (60 lines, tested in `text.test.ts`).
  A text with a plural is one sentence per plural category of the language (`{ one: '{count} spel', other: '{count} spellen' }`), so Arabic's six and Japanese's one fit later without changing the code.
- **Dutch holds the keys.** `nl.ts` is `as const`, and its keys and placeholders become the types: `t('status.won', { name })` is checked by the compiler for a key that exists and for the values it needs, and `Dictionary` (`Record<MessageKey, Message>`) makes a missing or extra key in another language a type error.
- **A missing text is caught by a test, not by a child.** `src/i18n/dictionaries.test.ts` checks for every other language that it has exactly the keys of Dutch (nothing missing, nothing left over), the same placeholders in each text, a plural text where Dutch has one with every plural category the language has (`Intl.PluralRules(locale)`), and no empty text.
  On top of that every screen has a component test in English and Frisian that also fails when a text of the Dutch dictionary is still on the screen (`dutchLeaks` in `src/i18n/testing.ts`: a Dutch text where another language should be), and an end-to-end test (`e2e/languages.spec.ts`) plays a game with two browsers in two languages.
- **Whole texts, never glued together.** A text with a number or a name in it is one sentence per language with `{placeholders}`, in the word order of that language (`'{name} ({shape})'`, `'Zet {step} van {total}'`).
  The words for how many in a row (`drie op een rij`) are texts of their own (`field.inARow.3`); other numbers use `field.inARow.other`.
  The one place where pieces are joined is a row of short notes behind a player's name, with a dash (`Anna (kruis) – jij – niet verbonden`): the dash is punctuation, every word is a text.
  A list of names ("Anna en Bo") is `Intl.ListFormat`.
  A text with an element in it (the room code in bold) is rendered by `<Rich>`, which still starts from one text.
- **What people typed is never translated.** Names go through as they are. A shape's name is a text (`shape.cross`), written as it is said in the middle of a sentence, and `title()` puts a capital on it when it starts one (it uses the language's own `toLocaleUpperCase`).
- **The language is chosen per device, like the look.** A group on the settings page, `Taal` (Nederlands, English, Frysk, each in its own language and marked with its own `lang`), kept in localStorage (`tic-tac-toe-ultra.language`).
  The first time it follows `navigator.languages` (the first one that the game has, `nl-BE` being Dutch), and is Dutch when it is none of ours. `public/appearance.js` sets `<html lang>`, `dir` and the page title before the first paint; `applyLanguage` (`src/i18n/store.ts`) keeps them right when the language changes. `src/i18n/language.test.ts` runs the script and compares what it leaves on the page with the app, so the two can't drift. `dir` is part of the registry (`ltr` for all three) so that right-to-left languages (#71) are one value.
- **The title of the page** is the name of the game in the language: "Boter, Kaas en Eieren Ultra", "Tic-Tac-Toe Ultra" (English; "Noughts and Crosses Ultra" was the other candidate, and the repository is already called Tic-Tac-Toe Ultra) and "Bûter, Tsiis en Aaien Ultra" (Frisian, read by a native speaker).
- **The addresses stay as they are.** `/kamer/BCDF`, `/spel/<id>`, `/spellen`, `/statistieken`, `/samen`: a link that is shared has to work for everybody, and the language is a choice of the reader, not of the link. Only the page changes.
- **The server stays language-free.** Its errors are codes (`room-full`, `shape-taken`, …) and its WebSocket close reasons are codes too; the app turns them into texts (`PROBLEMS` in `RoomPage.tsx`, the keys `problem.*`). The few plain-English bodies of the Worker (`Expected a WebSocket`, `No such room`) are never shown to a player: the app asks `GET /api/rooms/:code` first and reads the status. Nothing on the server changed for this.
- **Dates, numbers and lists follow the language** (`src/i18n/format.ts`): `Intl.DateTimeFormat`, `NumberFormat` and `ListFormat` with the locale of the language (`nl-NL`, `en-GB`, `fy-NL`). Frisian is not known to every browser, so `localeOf` checks `Intl.DateTimeFormat.supportedLocalesOf` and falls back to Dutch (`nl-NL`) where it isn't. The days of the week of the statistics come from the same API, so there is no list of them to translate. Numbers have at most one decimal (`2,3` or `2.3`).
- **Who writes and checks the translations.** Dutch is written by Vincent's family.
  The English and the Frisian are a first version written by Claude; English is easy to read, and Frisian **needs somebody who speaks it to read it before it goes out**.
  Rule: nothing is shipped in a language that has not been read by a person who speaks it.
  To make that true without blocking a merge, every language in the registry (`LANGUAGES` in `src/i18n/language.ts`, and the same flag in `public/appearance.js`) has `reviewed`: a language with `reviewed: false` is not offered in the picker and the browser's language never picks it.
  It is there to read: add `?alle-talen` to any address (`/?alle-talen`), choose the language, and the whole game is in it; once chosen it stays (and stays in the picker), and the style guide's language switch shows every language too.
  **Frisian was read by a native speaker (Vincent) on 2026-10-18, who found nothing to change, so `fy` is `reviewed: true`.** English is `reviewed: true` as well: Vincent confirmed the English texts, the title "Tic-Tac-Toe Ultra" and the names of the shapes in all three languages on 2026-10-18.
- **The names of the twelve shapes** are chosen by the person who drew them in Dutch; the English and Frisian names were a first version, confirmed by Vincent on 2026-10-18 (the style guide's page "Vormen" shows all twelve in the three languages next to the drawings). English: cross, circle, square, diamond, star, plus, asterisk, oval, heart, fort, waves, gold bar. Frisian: krús, sirkel, fjouwerkant, ruten, stjer, plus, stjerke, ovaal, hert, fort, weagen, goudbaar.
- **The rest that stays Dutch on purpose.** `manifest.webmanifest` (the name and description of the installed app: one file, Dutch, `lang: nl`) and the static `index.html` before the script runs (`lang="nl"`, replaced at once by `appearance.js`). `public/offline.html` is Dutch and has the English and Frisian texts in a small script that reads the same choice, because the service worker serves it without the app.
- **Adding a text.** Write the key and the Dutch text in `src/i18n/nl.ts`, and the same key with the same `{placeholders}` in `en.ts` and `fy.ts` (the compiler and `dictionaries.test.ts` tell you if one is missing), then use `t('the.key', { … })` from `useText()`.
  Outside a component (a function that makes a text), take `t` as a parameter, as `fieldLabel(t, field)` does.
  A story or test that needs a language calls `setLanguage('en')`; the tests start in Dutch (`src/test/setup.ts`), and Playwright's browsers are Dutch too (`locale: 'nl-NL'`).
- **Adding a language.** One line in `LANGUAGES` (id, name in its own language, locale, `dir`, `reviewed: false` until a person who speaks it has read it, then `true` in `LANGUAGES` and in `public/appearance.js`), one dictionary file with the same keys (plural categories as `Intl.PluralRules(locale)` says), the title in `public/appearance.js` and the three offline texts in `public/offline.html`; `dictionaries.test.ts`, `language.test.ts` and the TypeScript compiler check the rest.
  Fonts for other scripts, right-to-left layout and the CSS that depends on a language's length are for #71.

## Milestones

- **0 · Foundation:** project, CI, deploy.
- **1 · Playable 3×3:** the engine with tests, board and shapes, two players locally on one screen (to prove the engine and the UI).
- **2 · Online:** room server, create and join a room with a code, live moves, reconnecting.
- **3 · Big field:** configurable size and winning length, three or more players, choosing a shape, a field that grows with the game.
- **4 · History:** finished games are saved and can be watched again move by move, from a list of played games or a link. The engine already keeps the moves (milestone 1), so this builds on that.
- **5 · Polish:** the game in more languages (see Languages), animations, and the rest of what makes it nicer to play.

## Open questions

- The rules of the big field (how it grows, how many in a row) and more than twelve shapes: for milestone 3, not needed yet.
