import { readFileSync } from 'node:fs'
import { compileFunction } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { buildWorker } from './build.ts'

const ORIGIN = 'https://ultra.example'

interface FakeRequest {
  url: string
  method: string
  mode: string
  headers: Headers
}

function request(
  path: string,
  { method = 'GET', mode = 'no-cors', headers = {} } = {},
): FakeRequest {
  return { url: new URL(path, ORIGIN).href, method, mode, headers: new Headers(headers) }
}

/**
 * The worker of a build, run against a browser that is made of a few lines: a network that
 * answers (or doesn't) and the caches the worker keeps files in.
 */
function browser(files: readonly string[], seed: Record<string, Map<string, string>> = {}) {
  const stores = new Map(Object.entries(seed))
  const requested: string[] = []
  let online = true

  const network = (input: FakeRequest) => {
    requested.push(new URL(input.url).pathname)
    if (!online) return Promise.reject(new TypeError('Failed to fetch'))
    return Promise.resolve(new Response(`network: ${new URL(input.url).pathname}`))
  }

  const caches = {
    open: (name: string) => {
      const store = stores.get(name) ?? new Map<string, string>()
      stores.set(name, store)
      return Promise.resolve({
        addAll: async (requests: FakeRequest[]) => {
          for (const item of requests) {
            const response = await network(item)
            store.set(item.url, await response.text())
          }
        },
      })
    },
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
    match: (input: FakeRequest | string, options?: { cacheName?: string }) => {
      const url = typeof input === 'string' ? new URL(input, ORIGIN).href : input.url
      for (const [name, store] of stores) {
        if (options?.cacheName && name !== options.cacheName) continue
        const body = store.get(url)
        if (body !== undefined) return Promise.resolve(new Response(`cache: ${body}`))
      }
      return Promise.resolve(undefined)
    },
  }

  const listeners: Record<string, ((event: unknown) => void)[]> = {}
  const state = { skippedWaiting: false, claimed: false }
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      ;(listeners[type] ??= []).push(listener)
    },
    location: { origin: ORIGIN },
    skipWaiting: () => {
      state.skippedWaiting = true
      return Promise.resolve()
    },
    clients: {
      claim: () => {
        state.claimed = true
        return Promise.resolve()
      },
    },
  }

  class FakeRequestClass {
    readonly url: string
    readonly method = 'GET'
    readonly mode = 'no-cors'
    readonly headers = new Headers()
    constructor(path: string) {
      this.url = new URL(path, ORIGIN).href
    }
  }

  const run = compileFunction(buildWorker(files), [
    'self',
    'caches',
    'fetch',
    'Request',
    'Response',
  ]) as (...globals: unknown[]) => void
  run(scope, caches, network, FakeRequestClass, Response)

  /** Fires an event and gives back what the worker passed on to waitUntil or respondWith. */
  async function fire(type: string, event: Record<string, unknown> = {}) {
    let waited: Promise<unknown> | undefined
    let response: Promise<Response> | undefined
    const full = {
      ...event,
      waitUntil: (promise: Promise<unknown>) => (waited = promise),
      respondWith: (promise: Promise<Response>) => (response = promise),
    }
    for (const listener of listeners[type] ?? []) listener(full)
    await waited
    return response === undefined ? undefined : (await response).text()
  }

  return {
    stores,
    requested,
    state,
    goOffline: () => (online = false),
    install: () => fire('install'),
    activate: () => fire('activate'),
    fetch: (input: FakeRequest) => fire('fetch', { request: input }),
  }
}

const FILES = ['/assets/index-abc123.js', '/assets/index-def456.css']

describe('the service worker', () => {
  it('keeps the files of the build, the offline page and its picture, and takes over at once', async () => {
    const app = browser(FILES)
    await app.install()
    expect(app.stores.size).toBe(1)
    const [kept] = [...app.stores.values()]
    expect([...(kept?.keys() ?? [])].map((url) => new URL(url).pathname).sort()).toEqual(
      ['/assets/index-abc123.js', '/assets/index-def456.css', '/icon.svg', '/offline.html'].sort(),
    )
    expect(app.state.skippedWaiting).toBe(true)

    await app.activate()
    expect(app.state.claimed).toBe(true)
  })

  it('names the cache after the build: other files are another worker and another cache', () => {
    const one = buildWorker(FILES)
    expect(buildWorker([...FILES].reverse())).toBe(one)
    expect(buildWorker([...FILES, '/assets/new-123.js'])).not.toBe(one)
  })

  it('replaces an old version: its caches are deleted, caches that are not its own are left', async () => {
    const app = browser(FILES, {
      'ultra-old-build': new Map([[request('/assets/old.js').url, 'old']]),
      'something-else': new Map(),
    })
    await app.install()
    await app.activate()
    const names = [...app.stores.keys()]
    expect(names).toHaveLength(2)
    expect(names).toContain('something-else')
    expect(names).not.toContain('ultra-old-build')
  })

  it('never answers anything of the rooms and games, nor a WebSocket, whatever it has kept', async () => {
    const app = browser(FILES)
    await app.install()
    app.requested.length = 0
    for (const path of ['/api/rooms/BCDF', '/api/games', '/api/games/x', '/api']) {
      expect(await app.fetch(request(path))).toBeUndefined()
      expect(await app.fetch(request(path, { mode: 'navigate' }))).toBeUndefined()
    }
    expect(
      await app.fetch(request('/api/rooms/BCDF/ws', { headers: { Upgrade: 'websocket' } })),
    ).toBeUndefined()
    expect(await app.fetch(request('/x', { headers: { Upgrade: 'WebSocket' } }))).toBeUndefined()
    // It didn't even look at them: the browser sends them on by itself.
    expect(app.requested).toEqual([])
  })

  it('does not touch what is not ours: other sites, other methods, files it did not keep', async () => {
    const app = browser(FILES)
    await app.install()
    expect(
      await app.fetch({
        ...request('/assets/index-abc123.js'),
        url: 'https://elsewhere.test/assets/index-abc123.js',
      }),
    ).toBeUndefined()
    expect(await app.fetch(request('/assets/index-abc123.js', { method: 'POST' }))).toBeUndefined()
    expect(await app.fetch(request('/appearance.js'))).toBeUndefined()
  })

  it('starts from the files it has kept, without the network', async () => {
    const app = browser(FILES)
    await app.install()
    app.requested.length = 0
    app.goOffline()
    expect(await app.fetch(request('/assets/index-abc123.js'))).toBe(
      'cache: network: /assets/index-abc123.js',
    )
    expect(app.requested).toEqual([])
  })

  it('opens a screen from the network, always, so that it is the page of the server of now', async () => {
    const app = browser(FILES)
    await app.install()
    for (const path of ['/', '/kamer/BCDF', '/spel/abc']) {
      expect(await app.fetch(request(path, { mode: 'navigate' }))).toBe(`network: ${path}`)
    }
  })

  it('shows the offline page for a screen opened without a network', async () => {
    const app = browser(FILES)
    await app.install()
    app.goOffline()
    expect(await app.fetch(request('/kamer/BCDF', { mode: 'navigate' }))).toBe(
      'cache: network: /offline.html',
    )
  })

  it('has an offline page to fall back to', () => {
    const page = readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8')
    expect(page).toContain('Geen verbinding')
    expect(page).toContain('lang="nl"')
  })
})
