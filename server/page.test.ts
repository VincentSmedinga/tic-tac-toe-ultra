import { describe, expect, it } from 'vitest'
import type { Env } from './env.ts'
import worker from './index.ts'

/** A page as the build makes it: the picture of a link is named by its own address. */
const page = '<html><head><meta property="og:image" content="/og-image.png" /></head></html>'

/** An `ASSETS` that answers what Cloudflare does: the page, with a length and a tag of its own. */
function envWith(body: string, type = 'text/html; charset=utf-8') {
  const asked: string[] = []
  const env = {
    ASSETS: {
      fetch: (request: Request) => {
        asked.push(new URL(request.url).pathname)
        return Promise.resolve(
          new Response(request.method === 'HEAD' ? null : body, {
            headers: {
              'Content-Type': type,
              'Content-Length': body.length.toString(),
              ETag: '"build"',
            },
          }),
        )
      },
    },
  } as unknown as Env
  return { env, asked }
}

const get = (path: string, env: Env, host = 'game.example', init?: RequestInit) =>
  worker.fetch(new Request(`https://${host}${path}`, init) as never, env)

describe('the Worker and a page', () => {
  it('serves the page from the files, with the address it was asked on', async () => {
    const { env, asked } = envWith(page)
    for (const path of ['/', '/kamer/BCDF', '/spel/abcdefghijklmnop', '/statistieken']) {
      const response = await get(path, env, 'preview.example')
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/html')
      expect(await response.text()).toContain('content="https://preview.example/og-image.png"')
    }
    expect(asked).toEqual(['/', '/kamer/BCDF', '/spel/abcdefghijklmnop', '/statistieken'])
  })

  it('leaves out the length and the tag of the page as it was built, which no longer fit', async () => {
    const response = await get('/', envWith(page).env)
    expect(response.headers.has('Content-Length')).toBe(false)
    expect(response.headers.has('ETag')).toBe(false)
  })

  it('leaves anything that is not a page alone, and answers HEAD without a body', async () => {
    const { env } = envWith('{"a":1}', 'application/json')
    expect(await (await get('/', env)).text()).toBe('{"a":1}')
    const head = await get('/', envWith(page).env, 'game.example', { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
  })

  it('does not make a page of the files themselves', async () => {
    const { env, asked } = envWith(page)
    expect((await get('/assets/index.js', env)).status).toBe(404)
    expect(asked).toEqual([])
  })
})
