# CI, deploys and pull request pictures

Read this before changing a workflow, a deploy or how a pull request shows screenshots.

## CI (`.github/workflows/ci.yml`)

- It runs on every pull request (a draft gets the checks but no deploy) and on pushes to `main`.
- `Checks`: the Conventional Commits title of the pull request, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` and `pnpm build`.
- `Checks` also fails when the game's build holds any Storybook.
- `End-to-end` (pull requests only): two Chromium browsers play a whole game, a rematch, a dropped connection and a reload against the production build (`e2e/`).
- `Style guide`: builds Storybook and deploys it to an address of its own, see [style-guide.md](style-guide.md).
- `Deploy`: see below.
- The title is checked first and from GitHub as it is now, so after fixing a title, re-run the failed `Checks` job.
- Editing a title also runs the small `Pull request title` workflow (`pr-title.yml`), which isn't required. Keep the pattern of both in sync.
- The repository is public, so Actions minutes are free and everything runs on every pull request.
- Actions are pinned to a commit with the version in a comment.
- A new check that must pass is added to the ruleset by name.

## Deploys

- The app is a Cloudflare Worker with static assets (`wrangler.jsonc`, the Worker in `server/index.ts`, built with `@cloudflare/vite-plugin`).
- The `Deploy` job puts the build that `Checks` made on Cloudflare with `wrangler deploy`.
- A ready pull request is a Worker of its own, `tic-tac-toe-ultra-pr-<number>`; CI comments its address on the pull request, and `preview-cleanup.yml` deletes it when the pull request closes.
- `main` is production, `tic-tac-toe-ultra`.
- After a deploy it checks that the page and `/api/health` answer.
- It is skipped, with a notice, for a draft, for a fork, and until the one-time setup in the README is done.
- `public/_headers` holds the security headers; a full Content-Security-Policy comes with the rooms.

## Screenshots in a pull request

- A change people see shows one to three essential screenshots, on a phone or a tablet, in the light and the dark theme where the theme matters. Never with anything private in them.
- GitHub has no upload for a pull request's body from the command line, so the pictures live on the `pr-screenshots` branch. It holds nothing else and is never merged: one folder per pull request, `pr-<number>/`.
- Add them with a worktree: `git fetch origin pr-screenshots && git worktree add .claude/worktrees/pr-screenshots pr-screenshots`.
- Copy the files into `pr-<number>/`, commit and push.
- Embed them with `![What it shows](https://github.com/VincentSmedinga/tic-tac-toe-ultra/blob/pr-screenshots/pr-<number>/<file>.jpg?raw=true)`.
