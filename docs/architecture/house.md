# The house

Read this before changing a house: its server, its messages or its screen.
The decisions are in [docs/plan.md](../plan.md), House; guests (#97) build on this.

## Server

- A house is a Durable Object of its own (`server/house.ts`, SQLite storage, WebSocket Hibernation API), bound as `HOUSE` (migration `v3` in `wrangler.jsonc`).
- `house-logic.ts` holds the rules as pure functions (`join`, `choose`, `stateFor`), tested without Cloudflare (`house-logic.test.ts`).
- `house-session.ts` decides what happens on a message or a closed socket, through a `HouseHost` that the Durable Object implements and `house-session.test.ts` fakes.
- Who is on a socket (`Member`: token, name, shape, when they came in) lives in the socket's attachment; the storage holds the code, when it was last touched, and `HouseData`: the running invitations and the games it made (the newest 50, `GAMES_KEPT`).
- Who is in the house is the open sockets that have joined; a browser with two sockets is one person, and joining on a new socket closes the old one with `CLOSE_REPLACED`.
- A house is deleted a day after it was last touched while no socket is open (`mayGo` in `room-expiry.ts`); coming in and going away both touch it.
- The code is six digits (`newHouseCode` in `house-code.ts`, `houseCodeSchema`), so one field on the start screen tells it from a room's four consonants.
- A house holds at most one person per shape (`HOUSE_LIMIT`, 36); one more is refused with `house-full` and the socket is closed with 4409.
- The messages are in `shared/house-protocol.ts` (zod): a person says `join` (token, a required name, the shape of last time) or `choose`; the house answers with the whole `state` or an `error`, which only the sender hears.
- `join` sent again on the same socket changes the name and keeps the place in the list.
- A shape is unique in a house: `join` gives the shape asked for only when nobody else has it, `choose` answers `shape-taken`.
- The state lists the people in the order they came in, each with an id (the socket's), the typed name, `number` (2, 3, …) for a name somebody before them has (`nameNumbers` in `shared/house.ts`, capitals don't count), the shape and a status (`statusOf`: `free`, `inviting`, `invited`, `playing`; `watching` comes with #97).
- After those who have the house open, the list holds the people of a running invitation and of a round being played in a room of the house, also when they have the house closed, with the id they had when they were invited.
- A shape is held by everybody in that list, so nobody takes the shape of someone who is playing with the house closed.

## Inviting

- `invite` names people by their ids and a field (`fieldSchema`, as a room); everybody in it, the one who invites too, must have the house open, be `free` and have a shape, or it answers `not-free` or `shape-needed`.
- At most eleven are invited: the one who invites plays too, and a room holds twelve (`PLAYER_LIMITS`).
- Somebody invited isn't free until they answer no, so nobody is invited twice at once; `choose` answers `not-free` while someone is not free, since the room is played with the shape of the invitation.
- `answer` (yes or no) is for the open invitation of the sender, once; otherwise `no-invitation`.
- An invitation is over when everybody has answered or after a minute (`INVITATION_MS`); `settle` in `house-logic.ts` decides, the last answer and the house's alarm call it (`house-session.test.ts` moves the clock on).
- The alarm of a house is set for the first invitation that lapses, or else for a day after it was touched (`schedule` in `house.ts`).
- With two players or more (the one who invited first, then those who said yes) the house makes the room (`createForHouse` on a free room code) and keeps the game; with fewer it sends `invitation-off` to the one who invited and whoever said yes, and `no-room` when the room could not be made.
- The state of somebody in an invitation has `invitation` (who invited, the field, and each invited person's answer), and of somebody playing `room`, the code of their room.
- A room of the house reports `over` and `started` (`roomReport` on the Durable Object): who plays is `playing` until the round is over, and again after a rematch; a round the house hasn't heard of for a day counts as over.

## App

- `/huis/<code>` is `HousePage.tsx`: first "Wie ben je?" with the name of last time filled in (a name is required), then the house.
- `useHouse.ts` is the connection: it asks whether the house exists, opens the socket and joins; a lost connection is tried again after 0.5 s growing to 8 s.
- The socket is closed while the page is hidden and opened again when it is visible, so the others see a person go when they put the app away.
- The house shows its code, the link to copy, who is there (shape, name, "jij", "kiest nog", the status) and the shape picker with the others' shapes disabled.
- The shape chosen in the house is the shape of last time for the next room or house (`setShape`).
- `identity.ts` remembers the last house (`getLastHouse`); the start screen offers "Terug naar huis …" while it exists, and forgets it when it is gone.
- The start screen's "Maak een huis" makes one; its code field takes four letters or, once a digit is typed, six digits.
- "Een spel beginnen" (`Invite.tsx`) is for somebody free with a shape: the free people with a shape as checkboxes, the `FieldPicker` (starting from the field of the last room), and "Nodig uit".
- An invitation shows "<naam> nodigt je uit" with "Speel mee" and "Nee, dank je"; after yes, and for the one who invited, a line says the house waits for the others.
- Next to the others in your invitation the list says "ook uitgenodigd" (to the one who invited just "uitgenodigd"), "uitnodiging geaccepteerd" or "uitnodiging afgeslagen", instead of their status.
- Who made or said yes to an invitation goes to the room as soon as the state has `room`; somebody who comes into the house during their round gets "Naar je spel" instead.
- The problems about an invitation (`NOTICES` in `useHouse.ts`) are news: the house stays, and the next message the person sends puts them away.
- The shape can only be changed while free.
- Tests: `HousePage.test.tsx` (in Dutch, English and Frisian), `StartScreen.test.tsx`, `e2e/house.spec.ts` (two browsers in one house; three where one invites two, one says yes, they play and "Stoppen" goes back); stories: `HousePage.stories.tsx`.
