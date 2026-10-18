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

CI deploys the app to Cloudflare Pages: every ready pull request gets a preview (the address is commented on the pull request, like `https://<branch>.tic-tac-toe-ultra.pages.dev`), and a merge to `main` goes to production. A draft pull request runs the checks only. Until the one-time setup below is done, the deploy is skipped with a notice and the checks still run.

## One-time setup

Done once, by Vincent, in about a quarter of an hour. It uses the Cloudflare account of [Blokhut](https://github.com/VincentSmedinga/blokhut); run the commands in the repository folder.

1. Log Wrangler in: `pnpm exec wrangler login`.
2. Create the Pages project:

   ```sh
   pnpm exec wrangler pages project create tic-tac-toe-ultra --production-branch main
   ```

   This gives the project its address on pages.dev, normally https://tic-tac-toe-ultra.pages.dev (Cloudflare adds a suffix if the name is taken; the dashboard shows it under Workers & Pages).

3. Create an API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens): Create Token, Create Custom Token, with the permission Account · Cloudflare Pages · Edit. Copy the token, and the account id from the dashboard (Workers & Pages, in the sidebar).
4. Give both to GitHub as secrets. `gh` asks for each value, so it doesn't end up in your shell history or in a chat:

   ```sh
   gh secret set CLOUDFLARE_API_TOKEN
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

5. Run the CI workflow on `main` again (Actions, CI, Run workflow) to deploy the first production version.

The deploy of a pull request that comes from a fork is always skipped: forks can't use the secrets.
