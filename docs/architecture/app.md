# The app: screens, router and layout

Read this before adding a screen, an address or something in the footer.
The decisions are in [docs/plan.md](../plan.md), Decisions and Scrolling between screens.

## Screens and the router

- `src/online/route.ts` and `Link.tsx` are a minimal router on `history.pushState`: `/` the start screen, `/samen` the game on one screen, `/kamer/<code>` a room, `/spellen`, `/spel/<id>`, `/statistieken`.
- The addresses stay Dutch in every language.
- A new address goes in the router, in `PAGE_PATHS` and in `run_worker_first`, see [pwa.md](pwa.md).
- `StartScreen.tsx` makes a room: the number of players and the field.
- `RoomPage.tsx` is the lobby (code, who is there, free seats, the start button of the first seat, the shape picker) until `isStarted` in `started.ts` says every seat has a shape.
- `OnlineGame.tsx` is the board of a room. It only follows the server's `state` and sends a move or a rematch.
- `useRoom.ts` is one player's connection to a room: first asking whether it exists, then the WebSocket, joining with the token.
- A lost connection is tried again by itself, after 0.5 s growing to 8 s, and at once when the phone wakes up or the network is back; never when the room is gone or full.
- `identity.ts` keeps this browser's token, name and last room in localStorage, with a fallback to memory when storage is off. The start screen offers the way back to the last room while it exists.
- `play/` is the game on one screen: `Game` keeps the state with the engine, and starts with `ShapePicker`, once per player. The player who starts alternates every round.
- `play/FieldPicker.tsx` and `field.ts` choose and describe the field: presets, an own field with odd numbers only, a suggested row.
- The tests drive the room page with a fake socket (`RoomPage.test.tsx`).

## Scrolling between screens

- A new screen starts at the top, and back puts the page back, per history entry (`src/online/scroll.ts`, `history.scrollRestoration` is `manual`).
- `navigate()` in `route.ts` pushes its entries through `pushEntry`.
- A view that replaces another with no new address (the picker that becomes the board, the lobby that becomes the game, a game and its replay) calls `useScrollToTop(view)`. A new screen or view you add does the same.
- A state change while playing never moves the page.
- Tests: `scroll.test.tsx`, `RoomPage.test.tsx` and `e2e/scroll.spec.ts`.

## Layout and footer

- The page is `.app` with a `header` (the wordmark), the screen in `main`, and `SiteFooter` (`src/layout/`) as a real `contentinfo` landmark after `main`.
- The footer holds the links between screens ("Terug naar het begin", "Gespeelde spellen", "Statistieken"; the one for the screen you are on is left out) and the appearance, language and animation controls.
- Nothing is fixed over the screen, so a control never covers what a screen needs.
- A link to another screen belongs in the footer, not at the bottom of the screen.
- A button is as wide as what is on it.
- A new screen has to look right in all three looks, light and dark, see [appearance.md](appearance.md).
- Every screen has component tests in English and Frisian, see [i18n.md](i18n.md).
