import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { STORAGE_KEY } from '../i18n/language.ts'
import { resetLanguage } from '../i18n/store.ts'

// jsdom has no matchMedia: the app asks it whether the person wants less motion.
vi.stubGlobal(
  'matchMedia',
  (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList,
)

// The tests find things by their Dutch text, so they start in Dutch: jsdom's browser says English.
beforeEach(() => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['nl-NL', 'nl'])
  vi.spyOn(navigator, 'language', 'get').mockReturnValue('nl-NL')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.removeItem(STORAGE_KEY)
  resetLanguage()
  document.documentElement.lang = 'nl'
})
