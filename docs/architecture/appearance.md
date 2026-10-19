# Looks, colours and shapes

Read this before changing a colour, a look, a shape or a screen's styling.
The decisions are in [docs/plan.md](../plan.md), Shapes and colours and Look and feel.

## The choices

- How the game looks is chosen per device, in `src/appearance/`: three looks (`look.ts`, `data-look` on `<html>`) and light or dark (`scheme.ts`, `data-scheme`).
- Light or dark has two buttons, never a "Systeem": a pick that equals what the system gives is forgotten.
- The footer's `AppearanceControls.tsx` shows both choices. The `Wordmark` and the `Wallpaper` are on every screen.
- The `Wordmark` is the title with the app icon (an `<img>` of `public/icon.svg`) to its left, as high as the title's two lines. A look sets `--title-size` and may give `.wordmark-logo` an edge.
- `public/appearance.js` sets look, scheme and language before the first paint. Keep it in sync with `look.ts`, `scheme.ts` and `src/i18n/language.ts`; `language.test.ts` runs it and compares.
- The browser bar takes `--chrome`; a look may set it itself.

## Painting

- `src/styles/look-shared.css` is the layer all looks share; `look-drawn.css`, `look-playful.css` and `look-calm.css` paint under `html[data-look=…]`.
- Dark is `[data-scheme='dark']`, never a `prefers-color-scheme` query. `tokens.css` holds the colours of both schemes, and tests read them from there.
- A part's own CSS sits above the looks only where a rule says so (`Replay.css`, `PlayMode.css`, the bottom of `Stats.css`).
- The wallpaper is the twelve shapes drawn from the same paths; its loudness is a token of the look.

## The top and the bottom of the screen on iOS

- Nothing of the page is `position: fixed` against the screen's edges.
- iOS 26 and later draw a bar of their own, with a fade at its edge, behind the status bar and the toolbar next to such an element, and nothing in CSS turns that off. `src/styles/top-edge.test.ts` enforces it; see [docs/plan.md](../plan.md), Look and feel.
- The wallpaper lies in the page: `.wallpaper` is absolute, as high as the `body`, which is `position: relative`, and it scrolls with the page.
- The layer of the play mode is fixed by design and has a wallpaper of its own.
- `.app` starts its content a margin below the inset and has more room under the footer.
- A new fixed layer must keep clear of the edges of the page.

## Shapes and colours

- `src/shapes/shapes.ts` is the registry of the twelve shapes (id, Dutch name, the marker's name) and their drawings. `ShapeIcon` draws one in its own colour.
- Colours are tokens in `src/styles/tokens.css`, named after the shape (`--shape-cross`), with a lighter set for the dark theme.
- `src/styles/palette.test.ts` (with `color.ts`) keeps every shape at 3:1 against the page, the twelve colours apart from each other (also for red-green colour blindness), colourful, and in the hue family of their marker.
- When you change a colour, run it: the failing message says which pair is too close.
- The interface colours (`--line`, `--win`, `--focus`) are tokens too, with a contrast test.
- Shapes are always drawn on `--page`; their contrast is tested against it.
- After changing a shape or a colour, run `pnpm icons`, see [pwa.md](pwa.md).
