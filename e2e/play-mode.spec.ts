import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'

/** A player in a browser of their own, on a phone. */
async function newPlayer(browser: Browser, name: string, address = '/'): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    locale: 'nl-NL',
    viewport: { width: 412, height: 800 },
    hasTouch: true,
  })
  const page = await context.newPage()
  if (address === '/') {
    await page.goto('/instellingen')
    await page.getByLabel('Je naam (hoeft niet)').fill(name)
    await page.getByRole('link', { name: 'Start', exact: true }).click()
  } else {
    await page.goto(address)
  }
  return page
}

/** What the tests measure of an element; the e2e project has no DOM types of its own. */
interface Box {
  scrollWidth: number
  clientWidth: number
  scrollHeight: number
  clientHeight: number
}

const cell = (page: Page, row: number, col: number) =>
  page.getByRole('button', { name: new RegExp(`^Rij ${row.toString()}, kolom ${col.toString()}:`) })

test('one player plays in the full screen mode, the other does not see it, and back leaves the mode and not the game', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'Anna')
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()
  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await bo.getByRole('button', { name: 'cirkel', exact: true }).click()
  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()

  // Anna gives the whole screen to the field.
  const room = new RegExp(`/kamer/${code}$`)
  await anna.getByRole('button', { name: 'Volledig scherm' }).click()
  await expect(anna.getByRole('button', { name: 'Sluiten' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(anna.locator('html')).toHaveAttribute('data-play-mode', '')
  await expect(anna.locator('nav.main-nav')).toHaveAttribute('inert', '')
  await expect(anna.locator('header')).toHaveAttribute('inert', '')

  // The field is all there, with no scrolling of the page or of the field, and the menu is out of
  // the way; nothing of it is shared with Bo.
  const frame = anna.locator('.board-frame')
  expect(
    await frame.evaluate(
      (el: Box) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
    ),
  ).toBe(false)
  expect(await anna.locator('html').evaluate((el: Box) => el.scrollHeight > el.clientHeight)).toBe(
    false,
  )
  const board = await anna.locator('.board').boundingBox()
  expect(board?.width).toBeGreaterThan(412 * 0.85)
  await expect(bo.locator('html')).not.toHaveAttribute('data-play-mode')
  await expect(bo.getByRole('link', { name: 'Terug naar het begin' })).toBeVisible()

  // The game goes on as usual, in the mode and out of it.
  await cell(anna, 2, 2).click()
  await expect(cell(bo, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: kruis')
  await cell(bo, 1, 1).click()
  await expect(cell(anna, 1, 1)).toHaveAccessibleName('Rij 1, kolom 1: cirkel')
  await expect(anna.getByText('Jij bent aan de beurt')).toBeVisible()

  // Back closes the mode, not the game.
  await anna.goBack()
  await expect(anna.getByRole('button', { name: 'Volledig scherm' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )
  await expect(anna.locator('html')).not.toHaveAttribute('data-play-mode')
  await expect(anna.locator('nav.main-nav')).not.toHaveAttribute('inert')
  await expect(anna).toHaveURL(room)
  await expect(cell(anna, 2, 2)).toHaveAccessibleName('Rij 2, kolom 2: kruis')

  // F on the board opens it, Escape closes it.
  await cell(anna, 3, 3).focus()
  await anna.keyboard.press('f')
  await expect(anna.locator('html')).toHaveAttribute('data-play-mode', '')
  await anna.keyboard.press('Escape')
  await expect(anna.locator('html')).not.toHaveAttribute('data-play-mode')
  await expect(anna.getByRole('button', { name: 'Volledig scherm' })).toBeFocused()
  await expect(anna).toHaveURL(room)
})

test('a field that is too big keeps its cells and scrolls in its frame, while the page stays still', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'Anna')
  await anna.getByRole('button', { name: /Aanpassen/ }).click()
  await anna.getByRole('button', { name: /^Groot/ }).click()
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await bo.getByRole('button', { name: 'cirkel', exact: true }).click()
  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()

  await anna.getByRole('button', { name: 'Volledig scherm' }).click()
  const frame = anna.locator('.board-frame')
  expect(await frame.evaluate((el: Box) => el.scrollWidth > el.clientWidth)).toBe(true)
  const first = await anna.locator('.cell').first().boundingBox()
  expect(first?.width).toBeGreaterThanOrEqual(43.5)
  expect(await anna.locator('html').evaluate((el: Box) => el.scrollHeight > el.clientHeight)).toBe(
    false,
  )
})

test('asks the browser for the real full screen where it has it, and ends both together', async ({
  browser,
}) => {
  const page = await newPlayer(browser, 'Anna', '/samen')
  await page.getByRole('button', { name: 'Start' }).click()
  const available = await page.evaluate('document.fullscreenEnabled === true')
  await page.getByRole('button', { name: 'Volledig scherm' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-play-mode', '')
  if (available) {
    // The mode is the layer in any case; the browser's full screen is on top of it.
    await expect.poll(() => page.evaluate('document.fullscreenElement !== null')).toBe(true)
    // The browser draws nothing of the page behind it, so the layer brings the theme itself.
    await expect(page.locator('.game > .wallpaper')).toHaveCount(1)
    await expect(page.locator('.game')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  }
  await page.getByRole('button', { name: 'Sluiten' }).click()
  await expect(page.locator('html')).not.toHaveAttribute('data-play-mode')
  await expect.poll(() => page.evaluate('document.fullscreenElement === null')).toBe(true)
})

test('a player in the full screen mode can leave after the game: the mode closes and the page is free', async ({
  browser,
}) => {
  const anna = await newPlayer(browser, 'Anna')
  await anna.getByRole('button', { name: 'Nieuwe kamer' }).click()
  const code = (await anna.locator('.room-code').textContent()) ?? ''
  await anna.getByRole('button', { name: 'kruis', exact: true }).click()
  const bo = await newPlayer(browser, 'Bo')
  await bo.getByLabel('Code van de kamer').fill(code)
  await bo.getByRole('button', { name: 'Meedoen' }).click()
  await bo.getByRole('button', { name: 'cirkel', exact: true }).click()
  await expect(anna.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(bo.getByRole('group', { name: 'Speelveld' })).toBeVisible()

  await bo.getByRole('button', { name: 'Volledig scherm' }).click()
  await expect(bo.locator('html')).toHaveAttribute('data-play-mode', '')
  await cell(anna, 1, 1).click()
  await cell(bo, 2, 1).click()
  await cell(anna, 1, 2).click()
  await cell(bo, 2, 2).click()
  await cell(anna, 1, 3).click()
  await expect(bo.getByText('Anna heeft gewonnen!')).toBeVisible()

  // The header and the menu are out of reach in the mode; the way out is on the screen of the game.
  await bo.getByRole('button', { name: 'Stoppen' }).tap()
  await bo
    .getByRole('group', { name: /Stoppen\?$/ })
    .getByRole('button', { name: 'Stoppen' })
    .tap()
  await expect(bo.getByRole('button', { name: 'Nieuwe kamer' })).toBeVisible()
  await expect(bo.locator('html')).not.toHaveAttribute('data-play-mode')
  await expect(bo.locator('nav.main-nav')).not.toHaveAttribute('inert')
  await expect(anna.getByText('Bo heeft het spel verlaten.')).toBeVisible()
})
