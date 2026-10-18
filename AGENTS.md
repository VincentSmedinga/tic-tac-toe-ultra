# AGENTS.md

Tic-Tac-Toe Ultra is a game Vincent is building with his family: many players on one big field playing noughts and crosses together, with more shapes than X and O. Version 1 is plain tic-tac-toe (3×3, two players), built so that a bigger field, more players, "k in a row" and more shapes are configuration and new drawings afterwards. All product and architecture decisions are in [docs/plan.md](docs/plan.md); read it before changing anything substantial, and update it when a decision changes.

This file is the way of working for everyone who changes this repository, people and coding agents alike.

## Language

- Code, comments, commit messages, issues and pull requests: English.
- Everything the players see: Dutch. Short, friendly sentences.

## Way of working

- **Planning.** Work is planned as GitHub issues in milestones (`0 · Foundation`, `1 · Playable 3×3`, `2 · Online`, `3 · Big field`), labelled `app` (the frontend), `server` (the room server), `game` (the game engine and rules), `ops` (CI, deploys, tooling), `docs` or `bug`. The [project board](https://github.com/users/VincentSmedinga/projects) "Tic-Tac-Toe Ultra" shows them: add a new issue there too and move it along the Status column (Todo, In Progress, Done). Closed issues and merged pull requests move to Done by themselves. Tick an issue's checkboxes before or right after each item is done, not in a batch later. A pull request says `Closes #n` only when merging it finishes all of that issue's boxes (a box such as "the family tries it" can be ticked afterwards); otherwise it says `Part of #n`.
- **Pull requests only.** Every change goes through a pull request from a branch. `main` only changes by squash-merging a pull request. The first commit, with this documentation, is the one exception.
- **Authors.** Whoever writes a change is its author, so that someone else can review it: GitHub doesn't let anyone approve their own pull request. A coding agent commits under its own name, with the person who runs it as the committer, and opens its pull requests as itself, with Vincent as reviewer. Claude Code commits as `Claude <noreply@anthropic.com>`, set in `.claude/settings.json`, and works on GitHub as the `smedinga-claude` app (see [CLAUDE.md](CLAUDE.md)).
- **Branches.** Short and descriptive: `game-engine`, `shape-gallery`.
- **Commits.** Small and focused, one concern each, so the history explains itself. Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject` in the imperative, plus a body that says why. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `build`, `ci`, `chore`. The scope is optional and names the area: `game`, `app`, `server`.
- **Pull request.** A Conventional Commits title (it becomes the squash commit on `main`), a body that says what changes and why, `Closes #n` for finished issues, and the milestone. Fill in the template. Open it as a draft while the work is in progress and mark it ready when it's worth reviewing.
- **Keep AGENTS.md current.** A pull request that changes how we work (a convention, a command, a folder, a pattern) updates this file in the same pull request. This file describes what exists: add CI, commands and folders here when they arrive.

## Commands

Node 24 and pnpm 12 (`corepack enable` or a global pnpm).

| Command                             | What it does                                                |
| ----------------------------------- | ----------------------------------------------------------- |
| `pnpm install`                      | Install dependencies                                        |
| `pnpm dev`                          | Start the app on http://localhost:5173                      |
| `pnpm build`                        | Typecheck and build the app into `dist/`                    |
| `pnpm preview`                      | Serve `dist/` as built                                      |
| `pnpm check`                        | Everything CI will check: types, lint, formatting and tests |
| `pnpm typecheck`                    | Check all TypeScript projects                               |
| `pnpm lint`                         | ESLint (strict type-checked TypeScript, React hooks, a11y)  |
| `pnpm test` / `pnpm test:watch`     | Vitest, once or in watch mode                               |
| `pnpm format` / `pnpm format:check` | Format with Prettier / check formatting                     |

Tests sit next to the code as `*.test.ts(x)`: in `src/` they run in jsdom, in `shared/` and `server/` in Node.

## Structure (planned)

| Folder         | Holds                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `shared/game/` | The game engine: pure TypeScript, no browser or Node APIs, used by both the app and the server |
| `shared/`      | The message protocol between client and server (zod)                                           |
| `src/`         | The React app: board, shapes, lobby                                                            |
| `server/`      | The room as a Cloudflare Durable Object with WebSocket; the server is authoritative            |
| `docs/`        | The plan and decisions; `docs/reference/` holds source material such as the drawn shapes       |

`shared/` and `server/` are still empty; they fill up in the issues of milestones 1 and 2. The tooling follows [Blokhut](https://github.com/VincentSmedinga/blokhut). TypeScript stays on 6.0 until typescript-eslint supports 7.
