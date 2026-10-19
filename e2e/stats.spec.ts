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

type Player = Awaited<ReturnType<typeof connect>>

/** Two players in a room of their own on the odd field: Anna has the cross, Bo the circle. */
async function seat(request: APIRequestContext, baseURL: string, who: string) {
  const created = await request.post('/api/rooms', { data: FIELD })
  const { code } = (await created.json()) as { code: string }
  const anna = await connect(baseURL, code, `anna-${who}`.padEnd(24, 'a'), 'cross')
  const bo = await connect(baseURL, code, `bo-${who}`.padEnd(24, 'b'), 'circle')
  await expect.poll(() => bo.state()?.players.length).toBe(2)
  return { anna, bo }
}

/** Plays one round: whoever starts wins the top row, and the game is in the archive at the end. */
async function playRound(starter: Player, other: Player): Promise<void> {
  const turns: [Player, number, number][] = [
    [starter, 0, 0],
    [other, 0, 1],
    [starter, 1, 0],
    [other, 1, 1],
    [starter, 2, 0],
  ]
  for (const [player, x, y] of turns) {
    const before = player.state()?.moves.length ?? 0
    player.move(x, y)
    await expect.poll(() => player.state()?.moves.length).toBe(before + 1)
  }
  await expect.poll(() => starter.state()?.gameId).toBeDefined()
}

/** Plays a whole game in a room of its own: the cross wins the top row, starting at the corner. */
async function playGame(request: APIRequestContext, baseURL: string, who: string): Promise<void> {
  const { anna, bo } = await seat(request, baseURL, who)
  await playRound(anna, bo)
  anna.socket.close()
  bo.socket.close()
}

async function games(request: APIRequestContext) {
  const response = await request.get('/api/stats')
  expect(response.status()).toBe(200)
  const stats = statsSchema.parse(await response.json())
  return {
    stats,
    field: stats.kinds.find(({ width, height }) => width === 9 && height === 3),
  }
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

  // The page, from the menu of another screen, tells the same.
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Hoofdmenu' })
    .getByRole('link', { name: 'Statistieken' })
    .click()
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

test('rooms are counted, and so are the rounds played in each', async ({ request, baseURL }) => {
  if (baseURL === undefined) throw new Error('no baseURL')
  const before = (await games(request)).stats.rooms

  // One room with a rematch: the player after the first one starts the second round.
  const { anna, bo } = await seat(request, baseURL, 'rematch')
  await playRound(anna, bo)
  const first = anna.state()?.gameId
  anna.socket.send(JSON.stringify({ type: 'rematch' }))
  await expect.poll(() => bo.state()?.moves.length).toBe(0)
  await playRound(bo, anna)
  expect(anna.state()?.gameId).not.toBe(first)
  anna.socket.close()
  bo.socket.close()
  // And one that is made and played once.
  await playGame(request, baseURL, 'single')

  const { rooms } = (await games(request)).stats
  expect(rooms.made).toBeGreaterThanOrEqual(before.made + 2)
  expect(rooms.played).toBeGreaterThanOrEqual(before.played + 2)
  expect(rooms.rematches).toBeGreaterThanOrEqual(before.rematches + 1)
  expect(rooms.mostRounds).toBeGreaterThanOrEqual(2)
  expect(rooms.rounds.reduce((sum, count) => sum + count, 0)).toBe(rooms.played)
})
