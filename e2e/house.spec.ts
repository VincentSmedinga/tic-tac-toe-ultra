import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A person in a browser of their own: separate storage, so a separate token. */
async function newPerson(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'nl-NL',
  })
  const page = await context.newPage()
  await page.goto('/')
  return page
}

/** Says who you are and comes in. */
async function comeIn(page: Page, name: string) {
  await page.getByLabel('Je naam').fill(name)
  await page.getByRole('button', { name: 'Kom binnen' }).click()
}

const people = (page: Page) => page.getByRole('region', { name: 'Wie er is' }).getByRole('listitem')

test('two people in one house see each other, with their shapes, and see one go', async ({
  browser,
}) => {
  const anna = await newPerson(browser)
  await anna.getByRole('button', { name: 'Maak een huis' }).click()
  await comeIn(anna, 'Anna')
  await expect(people(anna)).toHaveText(['Anna – jij – kiest nog – vrij'])
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  expect(code).toMatch(/^\d{6}$/)
  await anna.getByRole('button', { name: 'hart', exact: true }).click()
  await expect(people(anna)).toHaveText(['Anna – jij – vrij'])

  // Bo comes in with the code, on the start screen's one field for codes.
  const bo = await newPerson(browser)
  await bo.getByLabel('Code van de kamer of het huis').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await expect(bo).toHaveURL(new RegExp(`/huis/${code}$`))
  await comeIn(bo, 'Anna')
  await expect(people(bo)).toHaveText(['Anna – vrij', 'Anna (2) – jij – kiest nog – vrij'])
  await expect(people(anna)).toHaveText(['Anna – jij – vrij', 'Anna (2) – kiest nog – vrij'])

  // The heart is Anna's: Bo can't have it, and chooses the star.
  await expect(bo.getByRole('button', { name: 'hart, van Anna' })).toBeDisabled()
  await bo.getByRole('button', { name: 'ster', exact: true }).click()
  await expect(people(anna)).toHaveText(['Anna – jij – vrij', 'Anna (2) – vrij'])

  // Bo closes the house: Anna sees it.
  await bo.context().close()
  await expect(people(anna)).toHaveText(['Anna – jij – vrij'])
})

test('the start screen leads back to the house this browser was in', async ({ browser }) => {
  const anna = await newPerson(browser)
  await anna.getByRole('button', { name: 'Maak een huis' }).click()
  await comeIn(anna, 'Anna')
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('link', { name: 'Start', exact: true }).click()
  await anna.getByRole('link', { name: `Terug naar huis ${code}` }).click()
  await expect(anna.getByLabel('Je naam')).toHaveValue('Anna')
})
