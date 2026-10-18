import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A player in a browser of their own, with the language their browser asks for. */
async function newPlayer(browser: Browser, locale: string, address = '/'): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale })
  const page = await context.newPage()
  await page.goto(address)
  return page
}

test('an English and a Frisian player play a whole game, each in their own language', async ({
  browser,
}) => {
  // Anna's browser is English, so the game is too the first time. Frisian is chosen by hand, and
  // only offered with ?alle-talen while nobody who speaks it has read it (src/i18n/language.ts).
  const anna = await newPlayer(browser, 'en-GB')
  await expect(anna.locator('html')).toHaveAttribute('lang', 'en')
  await expect(anna).toHaveTitle('Tic-Tac-Toe Ultra')
  await anna.getByLabel('Your name (optional)').fill('Anna')
  await anna.getByRole('button', { name: 'New room' }).click()
  await expect(anna.getByText('Waiting for a second player…')).toBeVisible()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)
  await anna.getByRole('button', { name: 'cross', exact: true }).click()

  const bo = await newPlayer(browser, 'nl-NL', '/?alle-talen')
  await bo.getByRole('group', { name: 'Taal' }).getByRole('button', { name: 'Frysk' }).click()
  await expect(bo.locator('html')).toHaveAttribute('lang', 'fy')
  await expect(bo).toHaveTitle('Bûter, Tsiis en Aaien Ultra')
  await bo.getByLabel('Dyn namme (hoecht net)').fill('Bo')
  await bo.getByLabel('Koade fan de keamer').fill(code)
  await bo.getByRole('button', { name: 'Meidwaan' }).click()
  await bo.getByRole('button', { name: 'sirkel', exact: true }).click()

  await expect(anna.getByRole('group', { name: 'Playing field' })).toBeVisible()
  await expect(bo.getByRole('group', { name: 'Spylfjild' })).toBeVisible()
  const english = (row: number, col: number) =>
    anna.getByRole('button', {
      name: new RegExp(`^Row ${row.toString()}, column ${col.toString()}:`),
    })
  const frisian = (row: number, col: number) =>
    bo.getByRole('button', {
      name: new RegExp(`^Rige ${row.toString()}, kolom ${col.toString()}:`),
    })

  await expect(anna.getByText('You start')).toBeVisible()
  await expect(bo.getByText('Anna begjint')).toBeVisible()

  // Anna (cross) wins on the top row; Bo (circle) plays the middle row. Each cell is named in the
  // language of whoever looks at it, and the shape in it too.
  await english(1, 1).click()
  await expect(frisian(1, 1)).toHaveAccessibleName('Rige 1, kolom 1: krús')
  await expect(bo.getByText('Do bist oan de beurt')).toBeVisible()
  await frisian(2, 1).click()
  await expect(english(2, 1)).toHaveAccessibleName('Row 2, column 1: circle')
  await expect(anna.getByText('It is your turn')).toBeVisible()
  await english(1, 2).click()
  await frisian(2, 2).click()
  await english(1, 3).click()

  await expect(anna.getByText('You have won!')).toBeVisible()
  await expect(bo.getByText('Anna hat wûn!')).toBeVisible()

  // The rematch lets the other player start, and says so in each language.
  await bo.getByRole('button', { name: 'Noch ien kear' }).click()
  await expect(bo.getByText('Do begjinst')).toBeVisible()
  await expect(anna.getByText('Bo starts')).toBeVisible()
  await expect(english(1, 1)).toHaveAccessibleName('Row 1, column 1: empty')
  await expect(frisian(1, 1)).toHaveAccessibleName('Rige 1, kolom 1: leech')

  // The choice of language is kept: loaded again, the page is still Frisian, without the parameter.
  await bo.goto(`/kamer/${code}`)
  await expect(bo.locator('html')).toHaveAttribute('lang', 'fy')
  await expect(bo.getByRole('group', { name: 'Spylfjild' })).toBeVisible()
})

test('a Dutch and an English player can play against each other, and change language on the way', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'nl-NL')
  await expect(anna.locator('html')).toHaveAttribute('lang', 'nl')
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  await expect(anna.getByText('Wachten op een tweede speler…')).toBeVisible()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()

  const bo = await newPlayer(browser, 'en-US')
  await bo.getByLabel('Code of the room').fill(code)
  await bo.getByRole('button', { name: 'Join' }).click()
  await bo.getByRole('button', { name: 'circle', exact: true }).click()
  await expect(bo.getByRole('group', { name: 'Playing field' })).toBeVisible()
  await expect(bo.getByText('Cross starts')).toBeVisible()
  await expect(anna.getByText('Jij begint')).toBeVisible()

  // Bo changes to Dutch in the middle of the game: everything on the screen follows at once.
  await bo
    .getByRole('group', { name: 'Language' })
    .getByRole('button', { name: 'Nederlands' })
    .click()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(bo.getByText('Kruis begint')).toBeVisible()
  await expect(bo.locator('html')).toHaveAttribute('lang', 'nl')
  await expect(bo).toHaveTitle('Boter, Kaas en Eieren Ultra')
})

test('the offline page speaks the language that was chosen', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'nl-NL',
  })
  await context.addInitScript(() => {
    localStorage.setItem('tic-tac-toe-ultra.language', 'en')
  })
  const page = await context.newPage()
  await page.goto('/offline.html')
  await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
