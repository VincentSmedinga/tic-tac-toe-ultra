import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A player in a browser of their own: separate storage, so a separate token. */
async function newPlayer(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'nl-NL',
  })
  const page = await context.newPage()
  await page.goto('/')
  return page
}

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('button', { name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`) })

test('two players play a game on the plus, and it is kept in its form', async ({ browser }) => {
  const anna = await newPlayer(browser)
  await anna.getByRole('button', { name: /Aanpassen/ }).click()
  await anna.getByRole('button', { name: /^Plus/ }).click()
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  await expect(anna.getByText('Wachten op een tweede speler…')).toBeVisible()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()

  const bo = await newPlayer(browser)
  await bo.getByLabel('Code van de kamer of het huis').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await bo.getByRole('button', { name: 'cirkel', exact: true }).click()

  for (const page of [anna, bo]) {
    await expect(page.getByText('Plus, vijf op een rij')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Rij / })).toHaveCount(45)
    await expect(cell(page, 1, 1)).toHaveCount(0)
    // The field is wider than the phone: it scrolls in its frame and the page stays where it is.
    expect(
      await page.evaluate(`(() => {
        const frame = document.querySelector('.board-frame')
        const root = document.documentElement
        return {
          frame: frame.scrollWidth > frame.clientWidth,
          page: root.scrollWidth > root.clientWidth,
        }
      })()`),
    ).toEqual({ frame: true, page: false })
  }

  // The cross takes five of the long row, from its far left end; the circle the top arm.
  for (const column of [1, 2, 3, 4]) {
    await cell(anna, 4, column).click()
    await cell(bo, column, 6).click()
  }
  await cell(anna, 4, 5).click()
  await expect(anna.getByText('Je hebt gewonnen!')).toBeVisible()
  for (const column of [1, 2, 3, 4, 5]) {
    await expect(cell(bo, 4, column)).toHaveAttribute('data-winning')
  }

  await bo.goto('/spellen')
  await bo.getByRole('link', { name: /veld Plus/ }).click()
  await expect(bo.getByText('Plus, vijf op een rij')).toBeVisible()
  await expect(bo.getByRole('button', { name: /^Rij / })).toHaveCount(45)
})
