# Installing, icons, link picture and service worker

Read this before changing the service worker, the manifest, the icons, `index.html` or a page address.
The decisions are in [docs/plan.md](../plan.md), Decisions (installable, service worker, a link has a face).

## Service worker

- `service-worker/worker.ts` is not served as it is. The Vite plugin in `service-worker/build.ts` turns it into `sw.js` when you build, with the build's files in front of it and the cache named after them. There is none in `pnpm dev`.
- It never touches `/api/*` or a WebSocket: no `respondWith`. Nothing live can come from a cache. `worker.test.ts` enforces it.
- A screen is always fetched from the network. Only when that fails does it answer with `public/offline.html` ("Geen verbinding").
- It keeps the build's `/assets/*` files and takes over at once.
- Change the worker with its test (`service-worker/worker.test.ts`).
- `src/pwa/register.ts` registers it (in a build only), asks for a new one when the app wakes, and loads the page again for a new version when the app is out of sight.
- `src/pwa/InstallHint.tsx` in the footer is the "Installeer de app" button (`beforeinstallprompt`) and the iOS tip "Tik op Deel en kies Zet op beginscherm", which can be closed for good.
- Playwright's offline mode stops a navigation before the worker sees it, so the offline page is not in `e2e/`.

## Icons and the link picture

- `scripts/icons.ts` makes `public/icon.svg`, `favicon.svg`, the PNGs and `public/og-image.png` (1200 × 630: the icon and the title in Patrick Hand, which it turns from WOFF into the TrueType file resvg reads) from `PATHS` and the dark colours of `tokens.css`.
- `public/manifest.webmanifest` is Dutch, one file, and is checked by `icons.test.ts` for its icons.
- Run `pnpm icons` after changing a shape or a colour. `scripts/icons.test.ts` fails when the files are out of date.
- `index.html` links the icons and the manifest, and holds the iOS tags and the `og:` and `twitter:` tags.
- The name under the home-screen icon is "Tic Tac Toe Ultra" (`short_name` and `apple-mobile-web-app-title`).

## Pages and the Worker

- The Worker answers the pages of the app (`server/page.ts`) and puts the address of the request in front of the picture's address, so one build is right for a preview, production and a later domain.
- The files themselves never wake the Worker.
- `PAGE_PATHS` in `server/page.ts` and `run_worker_first` in `wrangler.jsonc` repeat the router's addresses. Add a new address to the router and to both; `scripts/page-config.test.ts` fails otherwise.
- An installed app on iOS has its own storage, apart from Safari: another token, name and last room.
