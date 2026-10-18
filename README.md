# Tic-Tac-Toe Ultra

Noughts and crosses with many players on one big field, and many more shapes than X and O. A family project.

Version 1 is the game as it exists: 3×3, two players, X and O, played online and live. The game engine is built for more from the start: a bigger field, more players, "k in a row" and more shapes. The twelve shapes are drawn by hand, see [docs/reference/shapes.png](docs/reference/shapes.png) and [docs/reference/shapes-2.png](docs/reference/shapes-2.png).

- **Plan and decisions:** [docs/plan.md](docs/plan.md)
- **Way of working:** [AGENTS.md](AGENTS.md)
- **Planning:** the [milestones](https://github.com/VincentSmedinga/tic-tac-toe-ultra/milestones) and the project board "Tic-Tac-Toe Ultra"

## Local development

You need Node 24 and pnpm 12.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the app on http://localhost:5173. `pnpm check` runs everything CI will check; the other commands are in [AGENTS.md](AGENTS.md).

## Deploys

The app is a Cloudflare Worker with static assets: the Worker answers `/api/*` (the rooms of the game come here), the rest is the built app. CI deploys it: every ready pull request gets a Worker of its own as a preview (`https://tic-tac-toe-ultra-pr-<number>.<subdomain>.workers.dev`, commented on the pull request, deleted when the pull request closes), and a merge to `main` goes to production at `https://tic-tac-toe-ultra.<subdomain>.workers.dev`. A draft pull request runs the checks only. Until the one-time setup below is done, the deploy is skipped with a notice.

## One-time setup

Done once, by Vincent, in about a quarter of an hour. It uses the Cloudflare account of [Blokhut](https://github.com/VincentSmedinga/blokhut); run the commands in the repository folder.

1. Log Wrangler in: `pnpm exec wrangler login`.
2. Make sure the account has a `workers.dev` subdomain: in the [dashboard](https://dash.cloudflare.com), Workers & Pages, the subdomain is shown at the top right of the overview, with a button to choose one if there is none. It becomes part of the address of the game.
3. Give the API token that the deploy uses the right to deploy Workers: at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) edit the token `tic-tac-toe-ultra GitHub deploy` (or create a new custom token) and make its permissions Account · Workers Scripts · Edit, and keep Account · Cloudflare Pages · Edit while the old Pages project exists. The value of an existing token stays the same, so the GitHub secrets keep working; a new token goes in with `gh secret set CLOUDFLARE_API_TOKEN` (`gh` asks for the value, so it never ends up in a shell history or a chat).
4. If the secrets don't exist yet: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (the account id is in the dashboard, under Workers & Pages).
5. Run the CI workflow on `main` again (Actions, CI, Run workflow) to deploy production as a Worker.
6. When production answers at its new address, delete the old Pages project `tic-tac-toe-ultra` (dashboard, Workers & Pages, the project, Settings, Delete): its address, tic-tac-toe-ultra.pages.dev, stops working then.

The deploy of a pull request that comes from a fork is always skipped: forks can't use the secrets.
