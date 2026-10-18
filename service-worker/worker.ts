/**
 * The service worker of the game, as small as it can be. It does two things: it keeps the files
 * of the build, so that the app starts from the phone itself, and it shows a page of its own
 * ("Geen verbinding") when a screen is opened without a network.
 *
 * It is not a script of the app: the build (`build.ts`) puts BUILD and FILES in front of it,
 * strips the types and writes `sw.js`. In the browser it only runs from there.
 *
 * - Rooms are live, so `/api/*` (and with it the WebSocket) is never touched: the worker doesn't
 *   even answer those requests, the browser sends them on as if it weren't there.
 * - A screen (a navigation) always comes from the network, so that nobody opens a page that
 *   belongs to an older server; only when there is no network the offline page is shown.
 * - The files of the build have names that change with their content, so they are kept for the
 *   build that has them, under a cache whose name is the build: a new build is a new cache, and
 *   the caches of old builds are deleted when the new worker takes over.
 * - A new worker takes over at once (`skipWaiting`, `claim`), without anyone closing the app.
 */

declare const self: ServiceWorkerGlobalScope
/** Identifies the build: the cache is named after it, and a new build is a new worker. */
declare const BUILD: string
/** The files of the build to keep, as paths: the page's scripts, styles and fonts, and more. */
declare const FILES: readonly string[]

const PREFIX = 'ultra-'
const CACHE = `${PREFIX}${BUILD}`
const OFFLINE = '/offline.html'

/** The offline page and the picture on it, then the files of the build. */
const KEPT = new Set([OFFLINE, '/icon.svg', ...FILES])

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // `reload` skips the browser's own cache, so the files are the ones of this build.
      await cache.addAll([...KEPT].map((path) => new Request(path, { cache: 'reload' })))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The rooms and the games: always from the server, never from here.
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        async () => (await caches.match(OFFLINE, { cacheName: CACHE })) ?? Response.error(),
      ),
    )
    return
  }

  if (KEPT.has(url.pathname)) {
    event.respondWith(
      (async () => {
        const kept = await caches.match(request, { cacheName: CACHE })
        return kept ?? fetch(request)
      })(),
    )
  }
})
