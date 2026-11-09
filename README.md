# Tic-Tac-Toe Ultra

Noughts and crosses with many players on one big field, and many more shapes than X and O. A family project.

You play online and live, each on your own device, in a room with a code, or together on one screen. Whoever makes a room chooses the field (3 to 19, odd) and how many in a row win, and how many people play (2 to 12); everybody chooses their own shape of the thirty-six. The game's name in Dutch is "Boter, Kaas en Eieren Ultra". The first twelve shapes are drawn by hand, see [docs/reference/shapes.png](docs/reference/shapes.png) and [docs/reference/shapes-2.png](docs/reference/shapes-2.png); the other twenty-four are letters of the world's alphabets and a few symbols.

- **Plan and decisions:** [docs/plan.md](docs/plan.md)
- **Way of working:** [AGENTS.md](AGENTS.md)
- **How each area works:** [docs/architecture/](docs/architecture/)
- **Planning:** the [milestones](https://github.com/VincentSmedinga/tic-tac-toe-ultra/milestones) and the project board "Tic-Tac-Toe Ultra"

## Local development

You need Node 24 and pnpm 12.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts the app and the Worker on http://localhost:5173. `pnpm check` runs everything CI will check; the end-to-end tests (two browsers playing against each other) are `pnpm test:e2e`, once preceded by `pnpm exec playwright install chromium`. The other commands are in [AGENTS.md](AGENTS.md).

## Deploys

The app is a Cloudflare Worker with static assets: the Worker answers `/api/*` (the rooms of the game come here), the rest is the built app. CI deploys it: every ready pull request gets a Worker of its own as a preview (`https://tic-tac-toe-ultra-pr-<number>.<subdomain>.workers.dev`, commented on the pull request, deleted when the pull request closes), and a merge to `main` goes to production at https://tttu.nl (and still at `https://tic-tac-toe-ultra.<subdomain>.workers.dev`). The style guide (Storybook) is deployed the same way, as its own Worker with nothing of the game in it: `https://tic-tac-toe-ultra-styleguide.<subdomain>.workers.dev` for `main`, and a preview per ready pull request. A draft pull request runs the checks only. Until the one-time setup below is done, the deploy is skipped with a notice.

## One-time setup

Done once, by Vincent, in about a quarter of an hour. It uses the Cloudflare account of [Blokhut](https://github.com/VincentSmedinga/blokhut); run the commands in the repository folder.

1. Log Wrangler in: `pnpm exec wrangler login`.
2. Make sure the account has a `workers.dev` subdomain: in the [dashboard](https://dash.cloudflare.com), Workers & Pages, the subdomain is shown at the top right of the overview, with a button to choose one if there is none. It becomes part of the address of the game.
3. Give the API token that the deploy uses the right to deploy Workers: at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) edit the token `GitHub Actions – tic-tac-toe-ultra` (or create a new custom token) and make its permissions Account · Workers Scripts · Edit, and keep Account · Cloudflare Pages · Edit while the old Pages project exists. The value of an existing token stays the same, so the GitHub secrets keep working; a new token goes in with `gh secret set CLOUDFLARE_API_TOKEN` (`gh` asks for the value, so it never ends up in a shell history or a chat).
4. If the secrets don't exist yet: `gh secret set CLOUDFLARE_API_TOKEN` and `gh secret set CLOUDFLARE_ACCOUNT_ID` (the account id is in the dashboard, under Workers & Pages).
5. Run the CI workflow on `main` again (Actions, CI, Run workflow) to deploy production as a Worker.
6. When production answers at its new address, delete the old Pages project `tic-tac-toe-ultra` (dashboard, Workers & Pages, the project, Settings, Delete): its address, tic-tac-toe-ultra.pages.dev, stops working then.

### The domain tttu.nl

Done once, by Vincent. tttu.nl is registered at mijn.host; its DNS moves to Cloudflare, because a Worker only gets a custom domain in a zone that is on Cloudflare. Previews stay on workers.dev.

1. **DNSSEC off.** In the customer panel of mijn.host (not DirectAdmin), turn DNSSEC off for tttu.nl, so that the DS record at SIDN goes. Wait an hour (its TTL), until `dig +short tttu.nl DS @ns1.dns.nl` answers nothing. Name servers that change while the DS record is there make the domain unreachable.
2. **Add the domain to Cloudflare.** In the [dashboard](https://dash.cloudflare.com), Add a domain, `tttu.nl`, the Free plan. Delete the A and AAAA records it imports for `tttu.nl` and `www` (they point at mijn.host's web server). Mail at mijn.host needs the MX records, the SPF TXT, `x._domainkey` (DKIM) and `_dmarc`, all DNS only; Cloudflare's import tends to miss `x._domainkey`, so compare with mijn.host's list. Without mail on tttu.nl, delete them all, and the `_acme-challenge` TXT records too.
3. **Name servers.** In the customer panel of mijn.host, set the name servers of tttu.nl to the two Cloudflare shows. Cloudflare mails when the zone is active (for .nl usually within an hour).
4. **www.** In Cloudflare, add a DNS record `AAAA www 100::`, proxied, and a redirect rule from the template "Redirect from WWW to root" (Rules, Redirect Rules), so that `www.tttu.nl` goes to `tttu.nl`.
5. **The token.** Give `GitHub Actions – tic-tac-toe-ultra` Zone · Workers Routes · Edit and Zone · DNS · Edit, for the zone tttu.nl only.
6. **The variable.** `gh variable set PRODUCTION_DOMAIN --body tttu.nl`, then run the CI workflow on `main` again. The deploy waits until https://tttu.nl/api/health answers.
7. **DNSSEC on again**, now at Cloudflare: DNS, Settings, Enable DNSSEC, and put the DS record it shows in the customer panel of mijn.host.

The deploy of a pull request that comes from a fork is always skipped: forks can't use the secrets.
