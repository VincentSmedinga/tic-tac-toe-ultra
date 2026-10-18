/** The Worker: answers /api/*; every other address is the app, which Cloudflare serves itself. */
export default {
  fetch(request: Request): Response {
    const { pathname } = new URL(request.url)
    if (pathname === '/api/health') return Response.json({ status: 'ok' })
    return Response.json({ error: 'not-found' }, { status: 404 })
  },
} satisfies ExportedHandler
