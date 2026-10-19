# The app: screens, router and layout

Read this before adding a screen, an address or something to the menu.
The decisions are in [docs/plan.md](../plan.md), Decisions and Scrolling between screens.

## Screens and the router

- `src/online/route.ts` and `Link.tsx` are a minimal router on `history.pushState`: `/` the start screen, `/samen` the game on one screen, `/kamer/<code>` a room, `/spellen`, `/spel/<id>`, `/statistieken`, `/instellingen`.
- The addresses stay Dutch in every language.
- A new address goes in the router, in `PAGE_PATHS` and in `run_worker_first`, see [pwa.md](pwa.md).
- `StartScreen.tsx` is about one thing: "Nieuwe kamer", a room made with what the last one was made with (`getRoomChoice` in `identity.ts`, a classic room for two the first time). A line "2 spelers · 3 × 3, drie op een rij · Aanpassen" opens the number of players and the field picker. Joining with a code is one row, "Samen op één scherm" a button, and a line says whose name is used and links to the settings.
- `RoomPage.tsx` is the lobby (code, who is there, free seats, the start button of the first seat, the shape picker) until `isStarted` in `started.ts` says every seat has a shape.
- `OnlineGame.tsx` is the board of a room. It only follows the server's `state` and sends a move or a rematch.
- `useRoom.ts` is one player's connection to a room: first asking whether it exists, then the WebSocket, joining with the token.
- A lost connection is tried again by itself, after 0.5 s growing to 8 s, and at once when the phone wakes up or the network is back; never when the room is gone or full.
- `identity.ts` keeps this browser's token, name and last room in localStorage, with a fallback to memory when storage is off. The start screen offers the way back to the last room while it exists.
- "Terug naar het begin" and the menu do not leave a room: the seat stays and the start screen offers the way back. Only "Stoppen" on the end-of-game screen leaves: `leave` goes to the room, and when it closes the socket with `CLOSE_LEFT` the page clears the last room (`clearLastRoom`) and goes to the start. `RoomPage.tsx` also clears it on the problem `left`.
- "Stoppen" asks first in a room (`OnlineGame.tsx`, "Blijven" has the focus), is disabled while the connection is not open, and on `/samen` (`Game.tsx`) goes to the start at once.
- A seat that left stays in `state.players` with `left`: the room says who left (`online.left`) and not "even weg", shows only the shapes of the round (`config.players`), and offers no rematch when fewer than two are left.
- `play/` is the game on one screen: `Game` keeps the state with the engine, and starts with `ShapePicker`, once per player. The player who starts alternates every round.
- `play/FieldPicker.tsx` and `field.ts` choose and describe the field: presets, an own field with odd numbers only, a suggested row.
- The tests drive the room page with a fake socket (`RoomPage.test.tsx`).

## Scrolling between screens

- A new screen starts at the top, and back puts the page back, per history entry (`src/online/scroll.ts`, `history.scrollRestoration` is `manual`).
- `navigate()` in `route.ts` pushes its entries through `pushEntry`.
- A view that replaces another with no new address (the picker that becomes the board, the lobby that becomes the game, a game and its replay) calls `useScrollToTop(view)`. A new screen or view you add does the same.
- A state change while playing never moves the page.
- Tests: `scroll.test.tsx`, `RoomPage.test.tsx` and `e2e/scroll.spec.ts`.

## Layout and the menu

- The page is `.app` with a `header` (`SiteHeader`: the wordmark), the nav (`MainNav`), and the screen in `main`. There is no footer.
- `MainNav` (`src/layout/`) is a `nav` named "Hoofdmenu" with four links: the start, the games played, the statistics and the settings. The place you are in has `aria-current="page"`; `placeOf` in `place.ts` says which (a replay belongs to the games, a game being played to none).
- It comes right after the header in the page, so the keyboard reaches it first; on a phone `order: 1` puts it after the screen, as a bar of tabs, and from 48 rem it is a row under the title.
- A game on a phone has no bar. `.app` has `data-screen="game"` on `/samen` and in a room, and then the nav is hidden and the header is a "‹ Terug naar het begin" link (`.back-link`) with the title only for screen readers. From 48 rem the nav stays and the link is hidden.
- The menu is part of the page, never `position: fixed` or `sticky`: iOS draws a bar behind such an element at the edge of the screen, see [appearance.md](appearance.md). `MainNav.test.tsx` reads the CSS for it.
- A new screen goes in the menu only if it is one of the places you move between all day; anything else is reached from a screen.
- A choice that is kept per device (the look, the language, the name, the app) goes on the settings page, not on the screen it is about.
- Nothing is fixed over the screen, so a control never covers what a screen needs.
- A button is as wide as what is on it.
- A new screen has to look right in all three looks, light and dark, see [appearance.md](appearance.md).
- Every screen has component tests in English and Frisian, see [i18n.md](i18n.md).
