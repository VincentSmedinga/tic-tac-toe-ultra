import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { dutchLeaks } from '../i18n/testing.ts'
import { resetLanguage, setLanguage } from '../i18n/store.ts'
import { getName } from '../online/identity.ts'
import { SettingsPage } from './SettingsPage.tsx'

afterEach(() => {
  window.localStorage.clear()
  resetLanguage()
})

describe('SettingsPage', () => {
  it('has how the game looks, the language, the name and what the game is', () => {
    render(<SettingsPage />)
    expect(screen.getByRole('heading', { level: 2, name: 'Instellingen' })).toBeVisible()
    const looks = within(screen.getByRole('region', { name: 'Uiterlijk' }))
    expect(looks.getByRole('group', { name: 'Thema' })).toBeVisible()
    expect(looks.getByRole('group', { name: 'Licht of donker' })).toBeVisible()
    expect(looks.getByRole('group', { name: 'Animaties' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Taal' })).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Je naam (hoeft niet)' })).toBeVisible()
    const about = within(screen.getByRole('region', { name: 'Over' }))
    expect(about.getByText('Versie dev')).toBeVisible()
    expect(about.getByRole('link', { name: 'De code op GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/VincentSmedinga/tic-tac-toe-ultra',
    )
  })

  it('keeps the name as it is typed, for the rooms to use', async () => {
    render(<SettingsPage />)
    await userEvent
      .setup()
      .type(screen.getByRole('textbox', { name: 'Je naam (hoeft niet)' }), 'Eva')
    expect(getName()).toBe('Eva')
  })

  it('shows the name that is kept', () => {
    window.localStorage.setItem('tic-tac-toe-ultra.name', 'Sam')
    render(<SettingsPage />)
    expect(screen.getByRole('textbox', { name: 'Je naam (hoeft niet)' })).toHaveValue('Sam')
  })

  it('leaves out the app where there is nothing to install or to say', () => {
    render(<SettingsPage />)
    expect(screen.queryByRole('region', { name: 'De app' })).not.toBeInTheDocument()
  })

  it.each([
    ['en', 'Settings', 'Appearance', 'Language'],
    ['fy', 'Ynstellingen', 'Uterlik', 'Taal'],
  ] as const)('is in %s, with no Dutch left', (language, title, looks, languageGroup) => {
    setLanguage(language)
    render(<SettingsPage />)
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible()
    expect(screen.getByRole('region', { name: looks })).toBeVisible()
    expect(screen.getByRole('group', { name: languageGroup })).toBeVisible()
    expect(dutchLeaks(language)).toEqual([])
  })
})
