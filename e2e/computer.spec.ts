import { expect, test } from '@playwright/test'

test('one player plays a whole game against the computer, which thinks in the browser', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('link', { name: 'Tegen de computer' }).click()
  await expect(page).toHaveURL(/\/computer$/)

  // A bigger field, the strongest computer with a character of its own.
  await page.getByRole('button', { name: /^Groter/ }).click()
  await page.getByRole('button', { name: /^Moeilijk/ }).click()
  await page.getByRole('button', { name: /^Wildebras/ }).click()
  const worker = page.waitForEvent('worker')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText('Computer: Moeilijk, Wildebras')).toBeVisible()

  // Take the first free cell every turn, until somebody has won (the computer, no doubt).
  const status = page.getByRole('status')
  const free = page.locator('.cell[aria-disabled="false"]')
  for (let turn = 0; turn < 25; turn++) {
    await expect(status).toContainText(/Jij begint|Jij bent aan de beurt|gewonnen|Gelijkspel/)
    if (/gewonnen|Gelijkspel/.test((await status.textContent()) ?? '')) break
    await free.first().click()
  }
  await expect(status).toContainText('De computer heeft gewonnen!')
  await worker

  // The next round is the computer's to start.
  await page.getByRole('button', { name: 'Nog een keer' }).click()
  await expect(status).toContainText('Jij bent aan de beurt')
  await expect(page.getByRole('button', { name: /: cirkel$/ })).toHaveCount(1)
  expect(errors).toEqual([])
})

test('the address of the game against the computer opens it, also after a reload', async ({
  page,
}) => {
  await page.goto('/computer')
  await page.reload()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Rij 2, kolom 2: leeg' }).click()
  await expect(page.getByRole('button', { name: /: cirkel$/ })).toHaveCount(1)
})
