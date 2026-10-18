import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n/store.ts'
import { Wordmark } from './Wordmark.tsx'

describe('Wordmark', () => {
  it('is the name of the game as the one title, with the app icon to the left of it', () => {
    const { container } = render(<Wordmark />)
    const title = screen.getByRole('heading', { level: 1, name: 'Boter, Kaas en Eieren Ultra' })
    const logo = container.querySelector('img')
    expect(logo).toHaveAttribute('src', '/icon.svg')
    // The picture is only decoration: the title already says what the game is.
    expect(logo).toHaveAttribute('alt', '')
    expect(title.firstElementChild).toBe(logo)
  })

  it.each([
    ['en', 'Tic-Tac-Toe Ultra'],
    ['fy', 'Bûter, Tsiis en Aaien Ultra'],
  ] as const)('is the name of the game in %s', (language, name) => {
    setLanguage(language)
    render(<Wordmark />)
    expect(screen.getByRole('heading', { level: 1, name })).toBeVisible()
  })
})
