# AGENTS.md

Tic-Tac-Toe Ultra is a game Vincent is building with his family: many players on one big field playing noughts and crosses together, with more shapes than X and O.
Version 1 is plain tic-tac-toe (3×3, two players), built so that a bigger field, more players, "k in a row" and more shapes are configuration and new drawings afterwards.
All product and architecture decisions are in [docs/plan.md](docs/plan.md).
Read it before changing anything substantial, and update it when a decision changes.

This file is the way of working for everyone who changes this repository, people and coding agents alike.
It is loaded into every session, so it stays short: facts about one area go in `docs/architecture/` (see Structure).

## Language

- Code, comments, commit messages, issues and pull requests: English.
- Everything the players see: in the language they chose, Dutch (the first, and the one that is written first), English or Frisian, from the dictionaries in `src/i18n/` and never written in a component.
- Short, friendly sentences.
- A language is only offered once somebody who speaks it has read it (`reviewed` in `src/i18n/language.ts`), see docs/plan.md, Languages.
- Names that people typed are never translated.

## Way of working

- **Planning.** Work is planned as GitHub issues in milestones (`0 · Foundation`, `1 · Playable 3×3`, `2 · Online`, `3 · Big field`, `4 · History`, `5 · Polish`).
  - Labels: `app` (the frontend), `server` (the room server), `game` (the game engine and rules), `ops` (CI, deploys, tooling), `docs` or `bug`.
  - The [project board](https://github.com/users/VincentSmedinga/projects) "Tic-Tac-Toe Ultra" shows them: add a new issue there too and move it along the Status column (Todo, In Progress, Done).
  - Closed issues and merged pull requests move to Done by themselves.
  - Tick an issue's checkboxes before or right after each item is done, not in a batch later.
  - A pull request says `Closes #n` only when merging it finishes all of that issue's boxes (a box such as "the family tries it" can be ticked afterwards); otherwise it says `Part of #n`.
- **Pull requests only.** Every change goes through a pull request from a branch.
  - `main` only changes by squash-merging a pull request. The first commit, with this documentation, is the one exception.
  - A ruleset on `main` (Settings, Rules) makes a pull request, one approval and the `Checks` check a condition for merging, allows squash merges only, and refuses force pushes and deleting `main`. The repository's admins can bypass it on a pull request.
- **Authors.** Whoever writes a change is its author, so that someone else can review it: GitHub doesn't let anyone approve their own pull request.
  - A coding agent commits under its own name, with the person who runs it as the committer, and opens its pull requests as itself, with Vincent as reviewer.
  - Claude Code commits as `Claude <noreply@anthropic.com>`, set in `.claude/settings.json`, and works on GitHub as the `smedinga-claude` app (see [CLAUDE.md](CLAUDE.md)).
- **Branches.** Short and descriptive: `game-engine`, `shape-gallery`.
- **Commits.** Small and focused, one concern each, so the history explains itself.
  - Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` in the imperative, plus a body that says why.
  - Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`.
  - The scope is optional and names the area: `game`, `app`, `server`.
- **Pull request.** A Conventional Commits title (it becomes the squash commit on `main`), a body that says what changes and why, `Closes #n` for finished issues, and the milestone.
  - Fill in the template.
  - Open it as a draft while the work is in progress and mark it ready when it's worth reviewing.
  - A change people see shows one to three screenshots in it, see [ops.md](docs/architecture/ops.md).
- **CI and deploys.** GitHub Actions runs `Checks`, `End-to-end`, `Style guide` and `Deploy` on every pull request; a draft gets the checks but no deploy.
  - The Cloudflare Worker, the preview per pull request, the title check and the ruleset are in [ops.md](docs/architecture/ops.md). Read it before changing a workflow.
- **Keep AGENTS.md current.** A pull request that changes how we work (a convention, a command, a folder, a pattern) updates this file in the same pull request.
  - This file describes what exists: add commands and folders here when they arrive.
  - A new fact about one area goes as a bullet in that area's file in `docs/architecture/`: one fact per bullet, one sentence per line, never a sentence appended to a paragraph.
  - A new area gets a file of its own, with a line under Structure saying when to read it.
  - What the code already says (file and function names) is found with a search and doesn't belong in a file. Keep the rules, constraints and decisions, and name the test that enforces a rule.
  - A product or architecture decision and its reasons go in docs/plan.md.
  - How we work (commits, pull requests, CI) goes here or in `ops.md`.

## Commands

Node 24 and pnpm 12 (`corepack enable` or a global pnpm).

- `pnpm install`: install dependencies.
- `pnpm dev`: start the app and the Worker on http://localhost:5173.
- `pnpm build`: typecheck and build the app and the Worker into `dist/`.
- `pnpm preview`: serve the build (app and Worker) as Cloudflare does.
- `pnpm check`: everything CI checks, except the build: types, lint, formatting and tests.
- `pnpm typecheck`, `pnpm lint` (ESLint: strict type-checked TypeScript, React hooks, a11y), `pnpm format` / `pnpm format:check` (Prettier).
- `pnpm test` / `pnpm test:watch`: Vitest, once or in watch mode.
- `pnpm test:e2e`: build, then two browsers play a game against the build with the real Durable Object (once: `pnpm exec playwright install chromium`).
- `pnpm storybook`: the style guide on http://localhost:6100, with the three looks and light or dark in the toolbar.
- `pnpm build-storybook`: build the style guide into `storybook-static/` (CI does, and deploys it; it is not part of the game).
- `pnpm icons`: make the app icon's files in `public/` again, from the shapes' paths (`scripts/icons.ts`).

Tests sit next to the code as `*.test.ts(x)`: in `src/` they run in jsdom, in `shared/` and `server/` in Node.

## Structure

- `shared/game/`: the game engine, pure TypeScript with no browser or Node APIs, used by both the app and the server.
- `shared/`: what the app and the server share: the engine, `protocol.ts` (the WebSocket messages, zod) and `room.ts`.
- `src/`: the React app: board, shapes, lobby, replay, statistics.
- `server/`: the Worker (`index.ts`) and the rooms and archive (Durable Objects); the server is authoritative.
- `service-worker/`: the service worker's source and the build step that writes `sw.js`.
- `e2e/`: the Playwright tests, which need the build and a browser.
- `scripts/`: tools that make files: the app icon (`icons.ts`), with its test.
- `.storybook/`: the style guide's set-up; `src/**/*.stories.tsx` and `src/styleguide/` are its pages.
- `docs/`: the plan and decisions; `docs/architecture/` the facts per area; `docs/reference/` source material such as the drawn shapes.

Read the file for the area you work in before changing it:

- [game-engine.md](docs/architecture/game-engine.md): the rules, `shared/`, players as shapes.
- [server.md](docs/architecture/server.md): rooms, routes, messages, tokens, the archive.
- [stats.md](docs/architecture/stats.md): the statistics API and the page Statistieken.
- [app.md](docs/architecture/app.md): screens, the router, scrolling between screens, the footer.
- [appearance.md](docs/architecture/appearance.md): looks, light and dark, shape colours and their tests.
- [board.md](docs/architecture/board.md): the board's lines, cells and frame.
- [motion.md](docs/architecture/motion.md): how a shape is written and the rules for any animation.
- [play-mode.md](docs/architecture/play-mode.md): the full screen mode of a game.
- [replay-and-games.md](docs/architecture/replay-and-games.md): the replay and the pages of played games.
- [i18n.md](docs/architecture/i18n.md): texts, languages and formats.
- [pwa.md](docs/architecture/pwa.md): the service worker, icons, the link picture and page addresses.
- [style-guide.md](docs/architecture/style-guide.md): Storybook.
- [ops.md](docs/architecture/ops.md): CI, deploys and pull request screenshots.

## Rules that hold everywhere

- Import the engine from `shared/game/index.ts`; never reimplement a rule in the app or the server.
- The server is authoritative and only sends codes; the app has the words.
- Players' tokens never leave the server and are stored only as hashes.
- The service worker never answers `/api/*` (`service-worker/worker.test.ts`).
- Never put a gap or a border on `.cell` (`Board.test.tsx`, `src/styles/board-lines.test.ts`).
- A shape's colour change must pass `src/styles/palette.test.ts`; run `pnpm icons` after changing a shape or a colour.
- Keep `public/appearance.js` in sync with `look.ts`, `scheme.ts` and `language.ts`.
- A new address goes in the router, in `PAGE_PATHS` and in `run_worker_first` (`scripts/page-config.test.ts`).
- A new screen has to look right in all three looks, light and dark, and has component tests in English and Frisian.
- A new part or state that people see gets a story in the same pull request; nothing in the game imports a story.
- An animation uses only transforms, opacity and SVG strokes, and never holds the game up, see [motion.md](docs/architecture/motion.md).
