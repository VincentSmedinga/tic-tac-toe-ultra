/**
 * Registers the service worker (`sw.js`, made by the build, see service-worker/) and keeps the
 * app on its latest version without anyone closing it: it asks for a new worker when the app
 * wakes up, and when a new worker has taken over it loads the page again, at a moment nobody
 * sees it (the app is out of sight) and never in the middle of the game on one screen, which
 * lives only in the page.
 */

import { parseRoute } from '../online/route.ts'

interface Environment {
  container: ServiceWorkerContainer
  page: Document
  reload: () => void
  pathname: () => string
}

function browserEnvironment(): Environment {
  return {
    container: navigator.serviceWorker,
    page: document,
    reload: () => {
      window.location.reload()
    },
    pathname: () => window.location.pathname,
  }
}

export function registerServiceWorker(env: Environment = browserEnvironment()): void {
  const { container, page } = env
  // The first worker to take over a page that had none replaces nothing.
  let controlled = container.controller !== null
  let replaced = false

  const reloadIfHidden = () => {
    if (!replaced || page.visibilityState !== 'hidden') return
    if (parseRoute(env.pathname()).name === 'local') return
    env.reload()
  }

  container.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true
      return
    }
    replaced = true
    reloadIfHidden()
  })
  page.addEventListener('visibilitychange', reloadIfHidden)

  void container.register('/sw.js').then(
    (registration) => {
      page.addEventListener('visibilitychange', () => {
        if (page.visibilityState === 'visible') void registration.update().catch(() => undefined)
      })
    },
    () => undefined,
  )
}
