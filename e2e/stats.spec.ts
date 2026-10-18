import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { parseServerMessage, statsSchema } from '../shared/protocol.ts'
import type { StateMessage } from '../shared/protocol.ts'

/** A player without a browser: a socket on the real room, which keeps the last state it got. */
async function connect(baseURL: string, code: string, token: string, shape: string) {
  const socket = new WebSocket(`${baseURL.replace('http', 'ws')}/api/rooms/${code}/ws`)
  let last: StateMessage | undefined
  socket.addEventListener('message', (event) => {
    const message = parseServerMessage(event.data)
    if (message?.type === 'state') last = message
  })
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve()
    })
    socket.addEventListener('error', () => {
      reject(new Error('the socket did not open'))
    })
  })
  socket.send(JSON.stringify({ type: 'join', token, shape }))
  return {
    socket,
    state: () => last,
    move(x: number, y: number) {
      socket.send(JSON.stringify({ type: 'move', x, y }))
    },
  }
}

// A field no other test uses, so that what is counted here is only what this test played.
const FIELD = { width: 9, height: 3, winLength: 3 }

/** Plays a whole game in a room of its own: the cross wins the top row, starting at the corner. */
async function playGame(request: APIRequestContext, baseURL: string, who: string): Promise<void> {
  const created = await request.post('/api/rooms', { data: FIELD })
  const { code } = (await created.json()) as { code: string }
  const anna = await connect(baseURL, code, `anna-${who}`.padEnd(24, 'a'), 'cross')
  const bo = await connect(baseURL, code, `bo-${who}`.padEnd(24, 'b'), 'circle')
  await expect.poll(() => bo.state()?.players.length).toBe(2)

  const turns: [typeof anna, number, number][] = [
    [anna, 0, 0],
    [bo, 0, 1],
    [anna, 1, 0],
    [bo, 1, 1],
    [anna, 2, 0],
  ]
  for (const [player, x, y] of turns) {
    const before = player.state()?.moves.length ?? 0
    player.move(x, y)
    await expect.poll(() => player.state()?.moves.length).toBe(before + 1)
  }
  await expect.poll(() => anna.state()?.gameId).toBeDefined()
  anna.socket.close()
  bo.socket.close()
}

async function games(request: APIRequestContext) {
  const response = await request.get('/api/stats')
  expect(response.status()).toBe(200)
  const stats = statsSchema.parse(await response.json())
  return { stats, field: stats.kinds.find(({ width, height }) => width === 9 && height === 3) }
}

test('games that were played are counted, by the server and on the page', async ({
  page,
  request,
  baseURL,
}) => {
  if (baseURL === undefined) throw new Error('no baseURL')
  const before = (await games(request)).field?.games ?? 0

  for (const who of ['one', 'two', 'three']) await playGame(request, baseURL, who)

  const { stats, field } = await games(request)
  expect(field?.games).toBeGreaterThanOrEqual(before + 3)
  expect(field).toMatchObject({ players: 2, winLength: 3 })
  expect(stats.games).toBeGreaterThanOrEqual(3)
  // What is counted holds no name and no token, only numbers and shapes.
  expect(JSON.stringify(stats)).not.toMatch(/anna|bo-|aaaa|bbbb/i)
  const cross = stats.shapes.find(({ shape }) => shape === 'cross')
  expect(cross?.won).toBeGreaterThanOrEqual(3)

  // The page, from the footer of another screen, tells the same.
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: 'Statistieken' }).click()
  await expect(page).toHaveURL(/\/statistieken$/)
  await expect(page.getByRole('heading', { name: 'Statistieken', level: 2 })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Samen gespeeld' })).toBeVisible()
  const kind = page.getByRole('region', { name: 'Veld van 9 bij 3, 3 op een rij' })
  await expect(kind).toBeVisible()
  // The cross started at the top left corner and won along the top row, every time.
  await expect(
    kind.getByRole('img', { name: /^Waar begint iedereen\?: rij 1, kolom 1/ }),
  ).toBeVisible()
  await expect(
    kind.getByRole('img', { name: /^Waar staat de winnende rij\?: rij 1, kolom 1/ }),
  ).toBeVisible()
  // On a phone, the page does not scroll sideways.
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= document.documentElement.clientWidth',
    ),
  ).toBe(true)
})
