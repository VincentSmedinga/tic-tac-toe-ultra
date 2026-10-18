import { describe, expect, it } from 'vitest'
import worker from './index.ts'

describe('the Worker', () => {
  it('says it is up on /api/health', async () => {
    const response = worker.fetch(new Request('https://example.test/api/health'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('answers any other /api address with a 404', async () => {
    const response = worker.fetch(new Request('https://example.test/api/nope'))
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'not-found' })
  })
})
