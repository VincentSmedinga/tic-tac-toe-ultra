import { expect, test } from '@playwright/test'

test('the service worker is served fresh, takes over at once, and leaves the rooms alone', async ({
  page,
  request,
}) => {
  const worker = await request.get('/sw.js')
  expect(worker.headers()['cache-control']).toBe('no-cache')
  expect(worker.headers()['content-type']).toContain('javascript')

  await page.goto('/')
  // The e2e project has no DOM types: the page is asked with expressions.
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)')
  // It took over this page by itself, without a second visit.
  await page.waitForFunction('navigator.serviceWorker.controller !== null')

  // A room is asked from the server every time: the same address gives another answer once the
  // room exists, with the worker in between.
  const exists = (code: string) =>
    page.evaluate(
      async (path) => ((await (await fetch(path)).json()) as { exists: boolean }).exists,
      `/api/rooms/${code}`,
    )
  expect(await exists('BCDF')).toBe(false)
  const code = await page.evaluate(
    async () =>
      ((await (await fetch('/api/rooms', { method: 'POST' })).json()) as { code: string }).code,
  )
  expect(await exists(code)).toBe(true)
})

// Offline itself is not tested here: Playwright's offline mode stops a navigation before the
// service worker can answer it (the worker never sees it). The worker's fallback is tested in
// service-worker/worker.test.ts, and with a real browser by hand (docs/plan.md).
