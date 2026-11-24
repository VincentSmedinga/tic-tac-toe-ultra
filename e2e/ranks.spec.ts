import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A player in a browser of their own: separate storage, so a separate token. */
async function newPlayer(browser: Browser, name: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'nl-NL',
  })
  const page = await context.newPage()
  await page.goto('/instellingen')
  await page.getByLabel('Je naam (hoeft niet)').fill(name)
  await page.getByRole('link', { name: 'Start', exact: true }).click()
  return page
}

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('button', { name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`) })

test('after a game the summary ranks the moves, and jumps to the biggest mistake', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'Anna')
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()
  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer of het huis').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await bo.getByRole('button', { name: 'cirkel', exact: true }).click()
  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()

  // Nothing of the ranks is there while the game is on.
  await expect(anna.getByRole('button', { name: 'Bekijk samenvatting' })).toHaveCount(0)

  // Anna opens with a corner and Bo answers beside it, which gives the draw away (a blunder: only
  // the middle holds it). Anna wins with a fork on the anti-diagonal.
  await cell(anna, 1, 1).click()
  await cell(bo, 1, 2).click()
  await cell(anna, 2, 2).click()
  await cell(bo, 3, 3).click()
  await cell(anna, 3, 1).click()
  await cell(bo, 2, 1).click()
  await cell(anna, 1, 3).click()
  await expect(bo.getByText('Anna heeft gewonnen!')).toBeVisible()

  await bo.getByRole('button', { name: 'Bekijk samenvatting' }).click()
  await expect(bo.getByRole('heading', { name: 'Samenvatting' })).toBeFocused()
  await expect(bo.getByRole('article', { name: 'Bo (cirkel)' })).toBeVisible()
  await expect(bo.getByRole('article', { name: 'Anna (kruis)' })).toBeVisible()

  await bo.getByRole('button', { name: 'Grootste fout: zet 2 · ?? Blunder' }).click()
  await expect(bo.getByRole('slider')).toHaveValue('2')
  await expect(bo.getByText('Bo (cirkel) · ?? Blunder')).toBeVisible()
  await expect(bo.getByText('Beter was: rij 2, kolom 2')).toBeVisible()
  await expect(cell(bo, 2, 2)).toHaveAttribute('data-better')
})
