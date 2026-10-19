/** What the pages need of the Worker's bindings: the files of the build. */
export interface Pages {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

/**
 * The addresses of the app that is one page (src/online/route.ts), as `run_worker_first` in
 * wrangler.jsonc lists them: the Worker answers these, so that it can say in the page where its
 * picture is, and the files of the build (`/assets/*`, the icons) never wake it.
 */
export const PAGE_PATHS = ['/', '/samen', '/spellen', '/statistieken', '/spel/*', '/kamer/*']

/** The picture that goes with a link (scripts/icons.ts); index.html names it with this address. */
export const SHARE_IMAGE = '/og-image.png'

/** Whether an address of the Worker is one of the pages of the app. */
export function isPage(pathname: string): boolean {
  return PAGE_PATHS.some((path) =>
    path.endsWith('/*') ? pathname.startsWith(path.slice(0, -1)) : pathname === path,
  )
}

/**
 * A chat needs the full address of the picture of a link, which depends on where the page is
 * served: a preview of a pull request, production, a domain of its own later. index.html holds
 * `SHARE_IMAGE` as it is and the address is put in front of it here, from the request, so it is
 * always the address the page was asked for.
 */
export function withAbsoluteImage(html: string, origin: string): string {
  return html.replaceAll(`content="${SHARE_IMAGE}"`, `content="${origin}${SHARE_IMAGE}"`)
}

/** The page of the app, from the files of the build, with the full address of its picture. */
export async function servePage(request: Request, env: Pages): Promise<Response> {
  const response = await env.ASSETS.fetch(request)
  const isHtml = response.headers.get('Content-Type')?.includes('text/html') === true
  if (request.method !== 'GET' || !isHtml) return response

  const html = withAbsoluteImage(await response.text(), new URL(request.url).origin)
  // The length and the tag belonged to the page as it was in the build.
  const headers = new Headers(response.headers)
  headers.delete('Content-Length')
  headers.delete('ETag')
  return new Response(html, { status: response.status, statusText: response.statusText, headers })
}
