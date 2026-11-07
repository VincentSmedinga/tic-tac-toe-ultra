# Looks, colours and shapes

Read this before changing a colour, a look, a shape or a screen's styling.
The decisions are in [docs/plan.md](../plan.md), Shapes and colours and Look and feel.

## The choices

- How the game looks is chosen per device, in `src/appearance/`: three looks (`look.ts`, `data-look` on `<html>`) and light or dark (`scheme.ts`, `data-scheme`).
- Light or dark has two buttons, never a "Systeem": a pick that equals what the system gives is forgotten.
- The settings page (`src/settings/SettingsPage.tsx`) shows the choices: `AppearanceControls.tsx` (the three looks, light or dark, animations) and `LanguageControl.tsx`. The `Wordmark` and the `Wallpaper` are on every screen.
- `AppearanceSync.tsx` is in the `App`, so the page follows the system between light and dark on every screen, not only on the settings page.
- The `Wordmark` is the title with the app icon (an `<img>` of `public/icon.svg`) to its left, as high as the title's two lines. A look sets `--title-size` and may give `.wordmark-logo` an edge.
- `public/appearance.js` sets look, scheme and language before the first paint. Keep it in sync with `look.ts`, `scheme.ts` and `src/i18n/language.ts`; `language.test.ts` runs it and compares.
- The browser bar takes `--chrome`; a look may set it itself.

## Painting

- `src/styles/look-shared.css` is the layer all looks share; `look-drawn.css`, `look-playful.css` and `look-calm.css` paint under `html[data-look=…]`.
- Dark is `[data-scheme='dark']`, never a `prefers-color-scheme` query. `tokens.css` holds the colours of both schemes, and tests read them from there.
- A part's own CSS sits above the looks only where a rule says so (`Replay.css`, `PlayMode.css`, the bottom of `Stats.css`).
- The wallpaper is all the shapes drawn from the same paths, in a tile of six rows of six (`PLACES` in `Wallpaper.tsx`, a bit off a grid and turned); its loudness is a token of the look.

## The top and the bottom of the screen on iOS

- Nothing of the page is `position: fixed` against the screen's edges.
- iOS 26 and later draw a bar of their own, with a fade at its edge, behind the status bar and the toolbar next to such an element, and nothing in CSS turns that off. `src/styles/top-edge.test.ts` enforces it; see [docs/plan.md](../plan.md), Look and feel.
- The wallpaper lies in the page: `.wallpaper` is absolute, as high as the `body`, which is `position: relative`, and it scrolls with the page.
- The layer of the play mode is fixed by design and has a wallpaper of its own.
- `.app` starts its content a margin below the inset and has more room under the bar of places.
- A new fixed layer must keep clear of the edges of the page.

## Shapes and colours

- `src/shapes/shapes.ts` is the registry of the thirty-six shapes (the id, and the marker of the first twelve or what each of the other twenty-four is taken from) and their drawings. `ShapeIcon` draws one in its own colour.
- A shape's paths use only M, L, C, Q, T and Z in absolute coordinates (`pathLength` in `length.ts` throws at any other), every stroke is more than 5 units long (`length.test.ts`), and strokes of one shape are kept apart so that they don't run together under the thick line.
- A dot is a short stroke (about 6 units), never a zero-length one: it has to have a direction and a time to be written in.
- The first twelve shapes keep their place in `SHAPE_IDS` and `SHAPES`: stored games and the default choice depend on it. New shapes go at the end.
- Colours are tokens in `src/styles/tokens.css`, named after the shape (`--shape-cross`), with a lighter set for the dark theme.
- `src/styles/palette.test.ts` (with `color.ts`) keeps every shape at 3:1 against the page, the thirty-six colours apart from each other (also for red-green colour blindness; the first twelve keep the wider minimum they had), colourful, in one band of lightness, and in the hue family of their marker (or, for the twenty-four without one, of the hue they were found at).
- A new shape's colour is added to both sets in `tokens.css`, a hue window to the test, and a name to all three dictionaries; plan.md, Shapes and colours, says what the colours may vary in.
- When you change a colour, run it: the failing message says which pair is too close.
- The interface colours (`--line`, `--win`, `--focus`) are tokens too, with a contrast test.
- Shapes are always drawn on `--page`; their contrast is tested against it.
- After changing a shape or a colour, run `pnpm icons`, see [pwa.md](pwa.md).
