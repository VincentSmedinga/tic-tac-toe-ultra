import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const html = (page: Page) => page.locator('html')

test('the first look is Getekend, and light or dark is what the system says', async ({
  browser,
}) => {
  for (const [colorScheme, scheme] of [
    ['light', 'light'],
    ['dark', 'dark'],
  ] as const) {
    const context = await browser.newContext({
      baseURL: test.info().project.use.baseURL,
      locale: 'nl-NL',
      colorScheme,
    })
    const page = await context.newPage()
    await page.goto('/')
    await expect(html(page)).toHaveAttribute('data-look', 'drawn')
    await expect(html(page)).toHaveAttribute('data-scheme', scheme)
    await context.close()
  }
})

test('a person chooses a theme and light or dark, which is there at once and after a reload', async ({
  page,
}) => {
  await page.goto('/instellingen')
  await page.getByRole('button', { name: 'Speels' }).click()
  await page.getByRole('button', { name: 'Donker' }).click()
  await expect(html(page)).toHaveAttribute('data-look', 'playful')
  await expect(html(page)).toHaveAttribute('data-scheme', 'dark')

  // The script in the head puts it back before anything is drawn: look at the page as it loads.
  await page.reload()
  await expect(html(page)).toHaveAttribute('data-look', 'playful')
  await expect(html(page)).toHaveAttribute('data-scheme', 'dark')

  // It holds for the other screens too, and the game still plays.
  await page.getByRole('link', { name: 'Start', exact: true }).click()
  await page.getByRole('link', { name: 'Samen spelen' }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  await expect(html(page)).toHaveAttribute('data-look', 'playful')
})

test('every look paints its own background, and the page never scrolls sideways', async ({
  page,
}) => {
  await page.goto('/instellingen')
  const backgrounds = [
    ['Getekend', /url\(/],
    ['Speels', /linear-gradient/],
    ['Rustig', /^none$/],
  ] as const
  for (const [look, background] of backgrounds) {
    await page.getByRole('button', { name: look }).click()
    await expect(page.locator('body'), look).toHaveCSS('background-image', background)
    const wider = await page.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    )
    expect(wider, `${look} scrolls sideways`).toBe(false)
  }
})

test('the menu is part of the page, after the screen and never over it', async ({ page }) => {
  await page.goto('/')
  const menu = page.getByRole('navigation', { name: 'Hoofdmenu' })
  await expect(menu.getByRole('link', { name: 'Instellingen' })).toBeVisible()
  await expect(page.getByRole('contentinfo')).toHaveCount(0)
  // Nothing is fixed to the screen: the menu scrolls with the page.
  await expect(menu).toHaveCSS('position', 'static')
  await expect(menu.getByRole('link', { name: 'Spellen' })).toHaveCSS('position', 'static')
})

test('the choices of the look are on the settings page, which the menu opens', async ({ page }) => {
  await page.goto('/')
  await page
    .getByRole('navigation', { name: 'Hoofdmenu' })
    .getByRole('link', { name: 'Instellingen' })
    .click()
  await expect(page).toHaveURL(/\/instellingen$/)
  await expect(page.getByRole('region', { name: 'Uiterlijk' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Taal' })).toBeVisible()
})
