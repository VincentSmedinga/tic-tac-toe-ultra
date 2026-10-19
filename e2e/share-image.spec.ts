import { expect, test } from '@playwright/test'

// The picture of a link: the Worker puts the address a page was asked on in front of it (a chat
// needs the whole address), and the picture itself is served from the files.
test('a room link and the start page name the picture of the link by the address they were asked on', async ({
  request,
  baseURL,
}) => {
  for (const path of ['/', '/kamer/BCDF', '/spel/abcdefghijklmnop']) {
    const page = await request.get(path)
    expect(page.ok()).toBe(true)
    const html = await page.text()
    expect(html).toContain(`<meta property="og:image" content="${baseURL ?? ''}/og-image.png" />`)
    expect(html).toContain('<div id="root">')
  }
  const picture = await request.get('/og-image.png')
  expect(picture.headers()['content-type']).toBe('image/png')
})
