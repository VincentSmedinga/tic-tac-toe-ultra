# Full screen play mode

Read this before changing a game screen, the board's size or anything that must stay visible while playing.
The decision and its reasons are in [docs/plan.md](../plan.md), Full screen (issue #55).

- `usePlayMode()` (`src/play/playMode.ts`) gives a game screen `on`, `available`, `attachLayer`, `attachTrigger`, `toggle` and `close`.
- `attachLayer` and `attachTrigger` are the `ref`s of the section that holds the game and of the button, as functions. Pass them on as they are.
- Destructure the hook's result. Don't read a property of it in a `ref={…}` position, or react-hooks/refs takes the whole object for a ref.
- The section gets `data-play-mode`, and `PlayMode.css` turns it into a fixed layer over the page: the board, the bar (`.game-info`: players, status, `PlayModeButton`) and the actions.
- A new screen that has a game on it gives it a layer of its own the same way: a `.game` section with the hook, a `.game-info` bar, the button.
- Anything that has to stay visible in the mode goes inside the section. The room's connection notice is passed in as `banner`.
- While the mode is on, the siblings of the layer and of its ancestors are `inert`, and `html[data-play-mode]` locks the page.
- The real Fullscreen API is asked for where `document.fullscreenEnabled`. An iPhone has none, so there the mode is the layer alone.
- A state `{ playMode: true }` in the history makes back close the mode. Escape, F on the board and leaving the game close it too.
- The focus goes into the board and comes back to the button.
- The Wake Lock keeps the screen on while the mode is on.
- The board measures itself against its frame in container units, keeps the 2.75 rem cell minimum and scrolls what doesn't fit. Landscape puts the bar beside it.
- The layer paints the look's backdrop and a wallpaper of its own, because the browser's real full screen draws nothing of the page behind it.
- The mode is never shared with the room; a test checks that nothing is sent.
- The button and F are offered in an installed app too.
- Tests: `src/play/playMode.test.tsx`, `src/online/OnlineGame.test.tsx`, `e2e/play-mode.spec.ts` and the stories "Volledig scherm".
