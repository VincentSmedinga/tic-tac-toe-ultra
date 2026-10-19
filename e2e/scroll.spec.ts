import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/** The board, as the page measures it; the e2e project has no DOM types of its own. */
interface Box {
  top: number
  bottom: number
  viewport: number
  scrollY: number
}

/** The place of the page and of the board in it, from the page itself. */
function measure(page: Page): Promise<Box> {
  return page.evaluate<Box>(`(() => {
    const board = document.querySelector('.board-frame').getBoundingClientRect()
    return { top: board.top, bottom: board.bottom, viewport: innerHeight, scrollY }
  })()`)
}

test('the board starts at its top after Start, which is at the bottom of a tall picker', async ({
  page,
}) => {
  await page.goto('/samen')
  const start = page.getByRole('button', { name: 'Start' })
  await start.scrollIntoViewIfNeeded()
  expect(await page.evaluate('scrollY')).toBeGreaterThan(0)

  await start.click()
  await expect(page.getByRole('group', { name: 'Speelveld' })).toBeVisible()
  const { top, bottom, viewport, scrollY } = await measure(page)
  expect(scrollY).toBe(0)
  expect(top).toBeGreaterThan(0)
  expect(bottom).toBeLessThanOrEqual(viewport)
})

test('a link goes to the top of the next screen, and back puts the page where it was', async ({
  page,
}) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: 'Gespeelde spellen' })
  await link.scrollIntoViewIfNeeded()
  const before = await page.evaluate<number>('scrollY')
  expect(before).toBeGreaterThan(0)

  await link.click()
  await expect(page).toHaveURL(/\/spellen$/)
  await expect.poll(() => page.evaluate('scrollY')).toBe(0)

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect.poll(() => page.evaluate('scrollY')).toBe(before)
})
