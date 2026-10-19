# Style guide (Storybook)

Read this before adding a part that people see, or touching `.storybook/`.
The decision is in [docs/plan.md](../plan.md), Style guide.

- A part of the game gets a story next to it (`Board.stories.tsx`).
- A new part or state that people see gets a story in the same pull request.
- Pages that belong to no part (the shapes, tokens, buttons and cards) are in `src/styleguide/`.
- The tokens page reads `tokens.css` and the page's custom properties, so a new token or shape shows up without touching it.
- The toolbar sets `data-look` and `data-scheme` with `applyLook` and `applyScheme`, so a story shows what the game shows.
- Nothing in the game may import a story or `.storybook/`: the game's build must hold no style guide. CI checks.
- The style guide has its own Vite config and Worker (`.storybook/`); CI deploys it to an address of its own.
- The tooling follows [Blokhut](https://github.com/VincentSmedinga/blokhut). TypeScript stays on 6.0 until typescript-eslint supports 7.
