# The house

Read this before changing a house: its server, its messages or its screen.
The decisions are in [docs/plan.md](../plan.md), House; inviting (#96) and guests (#97) build on this.

## Server

- A house is a Durable Object of its own (`server/house.ts`, SQLite storage, WebSocket Hibernation API), bound as `HOUSE` (migration `v3` in `wrangler.jsonc`).
- `house-logic.ts` holds the rules as pure functions (`join`, `choose`, `stateFor`), tested without Cloudflare (`house-logic.test.ts`).
- `house-session.ts` decides what happens on a message or a closed socket, through a `HouseHost` that the Durable Object implements and `house-session.test.ts` fakes.
- A house keeps nobody who isn't there: who is on a socket (`Member`: token, name, shape, when they came in) lives in the socket's attachment, and its storage holds only the code and when it was last touched.
- Who is in the house is the open sockets that have joined; a browser with two sockets is one person, and joining on a new socket closes the old one with `CLOSE_REPLACED`.
- A house is deleted a day after it was last touched while no socket is open (`mayGo` in `room-expiry.ts`); coming in and going away both touch it.
- The code is six digits (`newHouseCode` in `house-code.ts`, `houseCodeSchema`), so one field on the start screen tells it from a room's four consonants.
- A house holds at most one person per shape (`HOUSE_LIMIT`, 36); one more is refused with `house-full` and the socket is closed with 4409.
- The messages are in `shared/house-protocol.ts` (zod): a person says `join` (token, a required name, the shape of last time) or `choose`; the house answers with the whole `state` or an `error`, which only the sender hears.
- `join` sent again on the same socket changes the name and keeps the place in the list.
- A shape is unique in a house: `join` gives the shape asked for only when nobody else has it, `choose` answers `shape-taken`.
- The state lists the people in the order they came in, each with an id (the socket's), the typed name, `number` (2, 3, …) for a name somebody before them has (`nameNumbers` in `shared/house.ts`, capitals don't count), the shape and a status (`free` for now; `playing` and `watching` come with #96 and #97).

## App

- `/huis/<code>` is `HousePage.tsx`: first "Wie ben je?" with the name of last time filled in (a name is required), then the house.
- `useHouse.ts` is the connection: it asks whether the house exists, opens the socket and joins; a lost connection is tried again after 0.5 s growing to 8 s.
- The socket is closed while the page is hidden and opened again when it is visible, so the others see a person go when they put the app away.
- The house shows its code, the link to copy, who is there (shape, name, "jij", "kiest nog", the status) and the shape picker with the others' shapes disabled.
- The shape chosen in the house is the shape of last time for the next room or house (`setShape`).
- `identity.ts` remembers the last house (`getLastHouse`); the start screen offers "Terug naar huis …" while it exists, and forgets it when it is gone.
- The start screen's "Maak een huis" makes one; its code field takes four letters or, once a digit is typed, six digits.
- Tests: `HousePage.test.tsx` (in Dutch, English and Frisian), `StartScreen.test.tsx`, `e2e/house.spec.ts` (two browsers in one house); stories: `HousePage.stories.tsx`.
