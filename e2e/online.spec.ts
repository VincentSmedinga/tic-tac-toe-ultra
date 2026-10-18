import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A player in a browser of their own: separate storage, so a separate token. */
async function newPlayer(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByLabel('Je naam (hoeft niet)').fill(name)
  return page
}

/** Anna makes a room, Bo joins it with the code: both end up on the board. */
async function startGame(browser: Browser) {
  const anna = await newPlayer(browser, 'Anna')
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  await expect(anna.getByText('Wachten op een tweede speler…')).toBeVisible()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)

  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()

  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  return { anna, bo, code }
}

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('button', { name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`) })

test('two players play a whole game, and a rematch, each in their own browser', async ({
  browser,
}) => {
  const { anna, bo } = await startGame(browser)
  await expect(anna.getByText('Jij begint')).toBeVisible()
  await expect(bo.getByText('Anna begint')).toBeVisible()

  // Anna (kruis) wins on the top row; Bo (cirkel) plays the middle row.
  await cell(anna, 1, 1).click()
  await expect(cell(bo, 1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')
  await expect(bo.getByText('Jij bent aan de beurt')).toBeVisible()
  await cell(bo, 2, 1).click()
  await expect(cell(anna, 2, 1)).toHaveAccessibleName('Rij 2, kolom 1: cirkel')
  await cell(anna, 1, 2).click()
  await cell(bo, 2, 2).click()
  await cell(anna, 1, 3).click()

  await expect(anna.getByText('Je hebt gewonnen!')).toBeVisible()
  await expect(bo.getByText('Anna heeft gewonnen!')).toBeVisible()
  for (const col of [1, 2, 3]) await expect(cell(bo, 1, col)).toHaveAttribute('data-winning')

  // Bo may not move after the game, and a rematch lets the other player start.
  await expect(cell(bo, 3, 3)).toHaveAttribute('aria-disabled', 'true')
  await bo.getByRole('button', { name: 'Nog een keer' }).click()
  await expect(bo.getByText('Jij begint')).toBeVisible()
  await expect(anna.getByText('Bo begint')).toBeVisible()
  await expect(cell(anna, 1, 1)).toHaveAccessibleName('Rij 1, kolom 1: leeg')
})

test('a player who is not on turn cannot move', async ({ browser }) => {
  const { anna, bo } = await startGame(browser)
  await expect(cell(bo, 2, 2)).toHaveAttribute('aria-disabled', 'true')
  await cell(bo, 2, 2).click({ force: true })
  await expect(cell(anna, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: leeg')
  await expect(anna.getByText('Jij begint')).toBeVisible()
})

test('a page that is loaded again in the middle of a game comes back to the same seat and game', async ({
  browser,
}) => {
  const { anna, bo } = await startGame(browser)
  await cell(anna, 2, 2).click()
  await expect(cell(bo, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: kruis')

  await bo.reload()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(cell(bo, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: kruis')
  await expect(bo.getByText('Jij bent aan de beurt')).toBeVisible()
  await cell(bo, 1, 1).click()
  await expect(cell(anna, 1, 1)).toHaveAccessibleName('Rij 1, kolom 1: cirkel')
})

test('a player whose connection drops is shown as away, and comes back by themselves', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'Anna')
  // Hold on to the WebSocket of Anna's page, so that the test can cut it.
  const sockets: { close: () => Promise<void> }[] = []
  await anna.routeWebSocket(/\/ws$/, (ws) => {
    ws.connectToServer()
    sockets.push({ close: () => ws.close() })
  })
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  await expect(anna.getByText('Wachten op een tweede speler…')).toBeVisible()
  const code = (await anna.locator('.room-code').textContent()) ?? ''

  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await cell(anna, 1, 1).click()
  await expect(cell(bo, 1, 1)).toHaveAccessibleName('Rij 1, kolom 1: kruis')

  // The connection of Anna is cut: Bo sees it, Anna sees it and the game stays on her screen.
  await sockets[0]?.close()
  await expect(bo.getByText(/Anna is even weg/)).toBeVisible()
  await expect(anna.getByRole('alert')).toContainText('verbroken')
  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()

  // Within seconds Anna is back, in the same seat and with the same game, and Bo sees that too.
  await expect(bo.getByText(/Anna is even weg/)).toBeHidden({ timeout: 15_000 })
  await expect(anna.getByRole('alert')).toBeHidden()
  expect(sockets.length).toBeGreaterThan(1)
  await cell(bo, 2, 2).click()
  await expect(cell(anna, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: cirkel')
})

test('a third player is told the room is full', async ({ browser }) => {
  const { code } = await startGame(browser)
  const third = await newPlayer(browser, 'Cas')
  await third.getByLabel('Code van de kamer').fill(code)
  await third.getByRole('button', { name: 'Meedoen' }).click()
  await expect(third.getByRole('alert')).toContainText('Deze kamer zit vol')
})

test('a code that does not exist is refused on the start screen', async ({ browser }) => {
  const player = await newPlayer(browser, 'Anna')
  await player.getByLabel('Code van de kamer').fill('BCDF')
  await player.getByRole('button', { name: 'Meedoen' }).click()
  await expect(player.getByRole('alert')).toContainText('Die kamer bestaat niet')
})
