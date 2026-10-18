/**
 * Stands in for the `cloudflare:workers` module in the Node tests (see vitest.config.ts), which only
 * exists inside Cloudflare's runtime. The tests that need the real Durable Object run in it: the
 * end-to-end test with two browsers.
 */
export class DurableObject<Env = unknown> {
  readonly ctx: unknown
  readonly env: Env

  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx
    this.env = env
  }
}
